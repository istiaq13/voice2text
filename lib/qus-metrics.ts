import type { StoryBlock } from './story-parser';

export interface StoryQualityScore {
  formatOk: boolean; // matches "As a X, I want Y so that Z"
  roleSpecific: boolean; // role isn't the generic word "user"
  hasAcceptanceCriteria: boolean; // at least one Given/When/Then line
  sizeOk: boolean; // story line isn't empty or absurdly long
  score: number; // 0..1 average of the checks above
}

const FORMAT_RE = /As a .+,?\s*I want .+,?\s*so that .+/i;
const GENERIC_ROLE_RE = /As a\s+user\b/i;
const AC_RE = /Given|When|Then/i;

// A lightweight, automatable approximation of QUS-style structural checks for
// a single story. This is not a substitute for human QUS scoring — it exists
// to drive the refinement loop cheaply; the paper's real quality numbers come
// from human raters.
export function scoreStoryQuality(block: StoryBlock): StoryQualityScore {
  const fullText = `${block.storyLine} ${block.details.join(' ')}`;
  const wordCount = block.storyLine.split(/\s+/).filter(Boolean).length;

  const formatOk = FORMAT_RE.test(fullText);
  const roleSpecific = !GENERIC_ROLE_RE.test(block.storyLine);
  const hasAcceptanceCriteria = block.details.some((d) => AC_RE.test(d));
  const sizeOk = wordCount >= 6 && wordCount <= 80;

  const checks = [formatOk, roleSpecific, hasAcceptanceCriteria, sizeOk];
  const score = checks.filter(Boolean).length / checks.length;

  return { formatOk, roleSpecific, hasAcceptanceCriteria, sizeOk, score };
}
