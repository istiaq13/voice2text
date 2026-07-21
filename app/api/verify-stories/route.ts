import { NextRequest, NextResponse } from 'next/server';
import { strictRateLimiter } from '@/lib/rate-limit';
import { parseStoryBlocks, type StoryBlock } from '@/lib/story-parser';
import { scoreStoryQuality } from '@/lib/qus-metrics';
import { scoreUserMetrics } from '@/lib/user-metrics';
import { alignAndScoreFaithfulness, selectJudgeProvider } from '@/lib/faithfulness';
import { buildRevisionPrompt, buildQualityOnlyRevisionPrompt } from '@/lib/prompt-builder';
import type { AIModel, RefinementMode, TranscriptSegment, RefinementAttempt, VerifiedStory, VerifyStoriesResponse } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Generous on purpose: this can run several stories through up to a few
// revision rounds each, on top of whichever model is doing the revising.
// Self-hosted research tool, not a serverless deploy with a hard cap.
export const maxDuration = 300;

const DEFAULT_FAITHFULNESS_THRESHOLD = 0.7;
const DEFAULT_QUALITY_THRESHOLD = 0.75;
const DEFAULT_MAX_ITERATIONS = 3;

const GENERATE_ENDPOINTS: Record<AIModel, string> = {
  gemini: '/api/generate-stories',
  groq: '/api/generate-stories-groq',
  llama: '/api/generate-stories-llama',
  qwen: '/api/generate-stories-qwen',
};

function blockToText(block: StoryBlock): string {
  return [block.storyLine, ...block.details].join('\n');
}

function qualityProblems(quality: ReturnType<typeof scoreStoryQuality>): string[] {
  const problems: string[] = [];
  if (!quality.formatOk) problems.push('It doesn\'t follow the required "As a X, I want Y so that Z" format.');
  if (!quality.roleSpecific) problems.push('It uses the generic role "user" instead of a specific role.');
  if (!quality.hasAcceptanceCriteria) problems.push('It is missing acceptance criteria (Given/When/Then).');
  if (!quality.sizeOk) problems.push('It is too short or too long to be a single, well-scoped story.');
  return problems;
}

// Grounded feedback names the faithfulness problem, tying the revision back
// to the transcript. Quality-only feedback deliberately never mentions the
// transcript or faithfulness at all — that's the whole point of the
// comparison arm.
function buildGroundedFeedback(faithful: boolean, faithfulReason: string, quality: ReturnType<typeof scoreStoryQuality>): string {
  const problems = qualityProblems(quality);
  if (!faithful) problems.unshift(`It includes details not supported by the transcript: ${faithfulReason}`);
  return problems.join(' ');
}

function buildQualityOnlyFeedback(quality: ReturnType<typeof scoreStoryQuality>): string {
  const problems = qualityProblems(quality);
  return problems.length > 0 ? problems.join(' ') : 'Make it clearer and more specific.';
}

async function requestRevision(origin: string, model: AIModel, prompt: string): Promise<string> {
  const endpoint = GENERATE_ENDPOINTS[model];
  const response = await fetch(`${origin}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || `Revision request failed: ${response.status}`);
  }

  const data = await response.json();
  const blocks = parseStoryBlocks(data.stories || '');
  return blocks.length > 0 ? blockToText(blocks[0]) : data.stories || prompt;
}

async function verifyOneStory(
  block: StoryBlock,
  segments: TranscriptSegment[],
  origin: string,
  model: AIModel,
  mode: RefinementMode,
  judge: ReturnType<typeof selectJudgeProvider>,
  faithThreshold: number,
  qualityThreshold: number,
  maxIterations: number
): Promise<VerifiedStory> {
  const originalText = blockToText(block);
  let currentText = originalText;
  const history: RefinementAttempt[] = [];

  let best: {
    text: string;
    faithfulScore: number;
    qualityScore: number;
    faithful: boolean;
    segmentId: number | null;
    start: number | null;
    end: number | null;
    reason: string;
  } | null = null;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const currentBlock = parseStoryBlocks(currentText)[0] ?? block;
    const quality = scoreStoryQuality(currentBlock);
    // Faithfulness is always measured, even in quality-only mode — that's
    // what lets us show whether quality-only refinement drifts away from the
    // source while the grounded loop doesn't.
    const faithfulness = await alignAndScoreFaithfulness(currentText, segments, judge);

    history.push({
      iteration,
      storyText: currentText,
      faithfulScore: faithfulness.faithfulScore,
      qualityScore: quality.score,
    });

    // Grounded mode ranks by both signals together; quality-only mode ranks
    // by quality alone, since that's the only thing it's trying to improve.
    const rank = mode === 'grounded' ? (faithfulness.faithfulScore + quality.score) / 2 : quality.score;
    const bestRank = best ? (mode === 'grounded' ? (best.faithfulScore + best.qualityScore) / 2 : best.qualityScore) : -Infinity;
    if (!best || rank > bestRank) {
      best = {
        text: currentText,
        faithfulScore: faithfulness.faithfulScore,
        qualityScore: quality.score,
        faithful: faithfulness.faithful,
        segmentId: faithfulness.segmentId,
        start: faithfulness.start,
        end: faithfulness.end,
        reason: faithfulness.reason,
      };
    }

    const passed =
      mode === 'grounded'
        ? faithfulness.faithfulScore >= faithThreshold && quality.score >= qualityThreshold
        : quality.score >= qualityThreshold;
    const isLastIteration = iteration === maxIterations - 1;
    if (passed || isLastIteration) break;

    let revisionPrompt: string;
    if (mode === 'grounded') {
      const feedback = buildGroundedFeedback(faithfulness.faithful, faithfulness.reason, quality);
      const sourceSegmentText = segments.find((s) => s.id === faithfulness.segmentId)?.text ?? null;
      revisionPrompt = buildRevisionPrompt(currentText, feedback, sourceSegmentText);
    } else {
      revisionPrompt = buildQualityOnlyRevisionPrompt(currentText, buildQualityOnlyFeedback(quality));
    }
    currentText = await requestRevision(origin, model, revisionPrompt);
  }

  // Reported alongside our own heuristic quality score, not used to gate the
  // loop — this keeps the already-verified loop behavior unchanged while
  // adding a literature-grounded quality signal for the paper's evaluation.
  const bestBlock = parseStoryBlocks(best!.text)[0] ?? block;

  return {
    storyText: best!.text,
    originalStoryText: originalText,
    segmentId: best!.segmentId,
    start: best!.start,
    end: best!.end,
    faithfulScore: best!.faithfulScore,
    qualityScore: best!.qualityScore,
    faithful: best!.faithful,
    verified:
      mode === 'grounded'
        ? best!.faithfulScore >= faithThreshold && best!.qualityScore >= qualityThreshold
        : best!.qualityScore >= qualityThreshold,
    reason: best!.reason,
    iterations: history.length,
    history,
    userMetrics: scoreUserMetrics(bestBlock),
    mode,
  };
}

export async function POST(req: NextRequest) {
  const rateLimitResult = await strictRateLimiter(req);
  if (rateLimitResult) return rateLimitResult;

  const body = await req.json();
  const segments: TranscriptSegment[] = body.segments || [];
  const storiesText: string = body.stories || '';
  const model: AIModel = body.model || 'gemini';
  const mode: RefinementMode = body.mode || 'grounded';
  const faithThreshold = body.thresholds?.faithfulness ?? DEFAULT_FAITHFULNESS_THRESHOLD;
  const qualityThreshold = body.thresholds?.quality ?? DEFAULT_QUALITY_THRESHOLD;
  const maxIterations = body.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  if (!storiesText.trim()) {
    return NextResponse.json({ error: 'stories text is required' }, { status: 400 });
  }
  if (!GENERATE_ENDPOINTS[model]) {
    return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 });
  }
  if (mode !== 'grounded' && mode !== 'quality-only') {
    return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
  }

  const blocks = parseStoryBlocks(storiesText);
  if (blocks.length === 0) {
    return NextResponse.json({ error: 'No stories could be parsed from the input text' }, { status: 400 });
  }

  let judge;
  try {
    judge = selectJudgeProvider();
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'No faithfulness judge is configured' }, { status: 500 });
  }

  try {
    const results: VerifiedStory[] = [];
    for (const block of blocks) {
      const verified = await verifyOneStory(
        block,
        segments,
        req.nextUrl.origin,
        model,
        mode,
        judge,
        faithThreshold,
        qualityThreshold,
        maxIterations
      );
      results.push(verified);
    }

    const verifiedCount = results.filter((r) => r.verified).length;
    const avgFaithfulScore = results.reduce((sum, r) => sum + r.faithfulScore, 0) / results.length;
    const avgQualityScore = results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length;

    const response: VerifyStoriesResponse = {
      judgeProvider: judge.name,
      mode,
      results,
      summary: { totalStories: results.length, verifiedCount, avgFaithfulScore, avgQualityScore },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Story verification error:', error);
    return NextResponse.json({ error: error.message || 'Story verification failed' }, { status: 500 });
  }
}
