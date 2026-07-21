import type { StoryBlock } from './story-parser';
import type { USeRMetrics } from '@/types';

// Adapts three of the eight metrics from USeR (Hallmann et al., "USeR: A
// Web-based User Story eReviewer for Assisted Quality Optimizations", arXiv
// 2503.02049, 2025) — the three that are computable on a single story in
// isolation. The other five (Independent, Small, Word Sparse, Sentence
// Sparse, Customer Speak) are defined relative to a full story backlog
// (cosine similarity against every other story, a topic model over the
// backlog, backlog-wide word/sentence-count statistics, an auto-extracted
// domain glossary) and don't have a meaningful value for the handful of
// stories generated from one meeting. They're deferred until we can pool the
// full experimental corpus (all meetings × models × conditions) as the
// backlog — see docs/System-and-Paper-Blueprint.md.
//
// The original Readable and Easy Language metrics were calibrated on German
// text (a German word list, the German-adjusted Flesch constant); this
// module re-derives both for English since our stories are English.

// A compact list of very common English words, standing in for the paper's
// German common-word list. Not exhaustive — good enough to separate plain
// phrasing from jargon-heavy phrasing, which is what the metric is for.
const COMMON_WORDS = new Set([
  'a','about','after','again','all','also','an','and','any','are','as','at','back','be','because','been',
  'before','being','below','between','both','but','by','call','can','come','could','day','did','do','does',
  'down','each','end','even','every','feel','few','find','first','for','from','get','give','go','good','had',
  'has','have','he','her','here','him','his','how','i','if','in','into','is','it','its','just','keep','know',
  'last','let','life','like','little','long','look','made','make','man','many','may','me','more','most','much',
  'must','my','name','need','new','no','not','now','of','off','old','on','once','one','only','open','or','other',
  'our','out','over','own','part','people','place','put','same','say','see','set','she','should','show','since',
  'so','some','still','such','take','tell','than','that','the','their','them','then','there','these','they',
  'thing','think','this','those','through','time','to','too','try','two','up','us','use','very','want','was',
  'way','we','well','were','what','when','where','which','while','who','why','will','with','without','work',
  'would','year','yes','yet','you','your',
  // domain-neutral verbs/nouns common in requirements phrasing
  'account','add','allow','app','application','create','data','delete','edit','email','file','list','login',
  'message','notify','order','page','password','report','save','search','send','system','update','user','view',
]);

function extractWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z']+/g) || []).filter(Boolean);
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  const stripped = w.replace(/e$/, '').replace(/^y/, '');
  const matches = stripped.match(/[aeiouy]+/g);
  return Math.max(1, matches ? matches.length : 1);
}

// Standard (English) Flesch Reading Ease: 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words).
function fleschReadingEase(text: string): number {
  const sentenceCount = Math.max(1, (text.match(/[.!?]+/g) || []).length);
  const words = extractWords(text);
  const wordCount = Math.max(1, words.length);
  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const score = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);
  return Math.max(0, Math.min(100, score));
}

// Our story format has no "title" or "attachments" fields like the original
// Connextra template USeR was built on, so Format Complete is adapted to the
// four fields our format actually has: role, goal, benefit, and at least one
// acceptance criterion.
function formatComplete(block: StoryBlock): number {
  const line = block.storyLine;
  // Checked independently, not as one combined pattern, so a story missing
  // only the benefit clause still gets credit for the role and goal it has —
  // matching how the original paper checks each template field separately.
  const hasRole = /As a (.+?)(?:,|\s+I want)/i.test(line);
  const hasGoal = /I want (.+?)(?:,?\s*so that|[.]|$)/i.test(line);
  const hasBenefit = /so that (.+)/i.test(line);
  const hasAcceptanceCriteria = block.details.some((d) => /Given|When|Then/i.test(d));

  const present = [hasRole, hasGoal, hasBenefit, hasAcceptanceCriteria].filter(Boolean).length;
  return present / 4;
}

function easyLanguage(text: string): number {
  const words = extractWords(text);
  const unique = new Set(words);
  if (unique.size === 0) return 0;
  let commonCount = 0;
  unique.forEach((w) => {
    if (COMMON_WORDS.has(w)) commonCount++;
  });
  return commonCount / unique.size;
}

export function scoreUserMetrics(block: StoryBlock): USeRMetrics {
  const fullText = [block.storyLine, ...block.details].join(' ');
  return {
    formatComplete: formatComplete(block),
    readable: fleschReadingEase(fullText),
    easyLanguage: easyLanguage(fullText),
  };
}
