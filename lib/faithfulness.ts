import { GoogleGenerativeAI } from '@google/generative-ai';
import type { TranscriptSegment } from '@/types';

export interface FaithfulnessResult {
  segmentId: number | null;
  start: number | null;
  end: number | null;
  faithfulScore: number; // 0..1 from the judge
  faithful: boolean;
  reason: string;
  judgeProvider: string;
}

export interface JudgeProvider {
  name: string;
  /** Given the raw prompt text, returns the model's raw text response. */
  complete(prompt: string): Promise<string>;
}

function isPlaceholderKey(key: string | undefined): boolean {
  if (!key) return true;
  return /^AIzaSyX+$|^gsk_X+$|X{10,}/.test(key);
}

const MAX_SEGMENTS_LISTED = 150;

// One combined call finds the best-matching transcript segment for a story
// AND judges whether the story invents anything beyond it. A prior embedding
// step to pre-select a candidate segment was dropped: it added a dependency
// (a working embeddings endpoint) without a clear benefit — LLM judges are
// reported to outperform embedding-based matchers at this kind of alignment
// task anyway (Inter2US, arXiv 2510.08622).
function buildPrompt(storyText: string, segments: TranscriptSegment[]): string {
  const listed = segments.slice(0, MAX_SEGMENTS_LISTED);
  const segmentList = listed
    .map((s) => `[id=${s.id} t=${s.start.toFixed(1)}-${s.end.toFixed(1)}s] ${s.text}`)
    .join('\n');

  return `You are checking a generated user story against the meeting transcript it was supposedly derived from.

Transcript segments:
"""
${segmentList}
"""

Generated user story:
"""
${storyText}
"""

1. Identify which single segment ID best supports this story (the moment in the meeting that most closely matches what the story describes).
2. Judge whether the story invents any role, feature, condition, or benefit that is NOT supported by that segment. Minor rephrasing is fine; invented specifics are not.

Respond with ONLY a JSON object, no other text:
{"segmentId": <id of the best matching segment>, "faithful": true or false, "score": a number from 0 to 1 where 1 means fully supported and 0 means entirely invented, "reason": "one short sentence"}`;
}

function parseJudgeResponse(
  text: string,
  segments: TranscriptSegment[]
): { segmentId: number | null; faithfulScore: number; faithful: boolean; reason: string } {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    const parsedId = typeof parsed.segmentId === 'string' ? Number(parsed.segmentId) : parsed.segmentId;
    const segmentId = segments.some((s) => s.id === parsedId) ? parsedId : null;
    return {
      segmentId,
      faithfulScore: typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0,
      faithful: Boolean(parsed.faithful),
      reason: typeof parsed.reason === 'string' ? parsed.reason : 'No reason given.',
    };
  } catch {
    return { segmentId: null, faithfulScore: 0, faithful: false, reason: 'Judge response could not be parsed.' };
  }
}

// ─── Providers ────────────────────────────────────────────────────────────────

export function createGeminiJudgeProvider(genAI: GoogleGenerativeAI): JudgeProvider {
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  return {
    name: `gemini:${modelName}`,
    async complete(prompt) {
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { temperature: 0 } });
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    },
  };
}

export function createOllamaJudgeProvider(model: string): JudgeProvider {
  return {
    name: `ollama:${model}`,
    async complete(prompt) {
      const base = (process.env.LLAMA_API_URL || 'http://localhost:11434/api/generate').replace('/api/generate', '');
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          options: { temperature: 0 },
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) throw new Error(`Ollama judge error: ${res.status}`);
      const data = await res.json();
      return data.message?.content || '';
    },
  };
}

// Prefers Gemini (a single consistent judge regardless of which model
// generated the story, per the study design), but falls back to a local
// Ollama model when no cloud key is configured, so the pipeline still runs
// end to end without a paid API key. FAITHFULNESS_JUDGE=ollama forces the
// fallback even when a real-looking Gemini key is present — needed because a
// key can be syntactically valid but unusable (e.g. zero quota on the
// project), which the placeholder check can't detect.
export function selectJudgeProvider(): JudgeProvider {
  const forced = process.env.FAITHFULNESS_JUDGE;
  const googleKey = process.env.GOOGLE_API_KEY;

  if (forced !== 'ollama' && !isPlaceholderKey(googleKey)) {
    return createGeminiJudgeProvider(new GoogleGenerativeAI(googleKey!));
  }
  const fallbackModel = process.env.OLLAMA_JUDGE_MODEL || process.env.LLAMA_MODEL || 'llama3.1:8b';
  return createOllamaJudgeProvider(fallbackModel);
}

// ─── Alignment ────────────────────────────────────────────────────────────────

export async function alignAndScoreFaithfulness(
  storyText: string,
  segments: TranscriptSegment[],
  judge: JudgeProvider
): Promise<FaithfulnessResult> {
  if (segments.length === 0) {
    return {
      segmentId: null,
      start: null,
      end: null,
      faithfulScore: 0,
      faithful: false,
      reason: 'No transcript segments available to check against.',
      judgeProvider: judge.name,
    };
  }

  const raw = await judge.complete(buildPrompt(storyText, segments));
  const judged = parseJudgeResponse(raw, segments);
  const anchor = judged.segmentId !== null ? segments.find((s) => s.id === judged.segmentId) : undefined;

  return {
    segmentId: anchor?.id ?? null,
    start: anchor?.start ?? null,
    end: anchor?.end ?? null,
    faithfulScore: judged.faithfulScore,
    faithful: judged.faithful,
    reason: judged.reason,
    judgeProvider: judge.name,
  };
}
