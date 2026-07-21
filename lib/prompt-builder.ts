import type { OutputFormat } from '@/types';

// Used by the source-grounded refinement loop to rewrite a single story that
// failed its faithfulness or quality check, without regenerating the whole
// batch. Keeping the model anchored to the transcript segment (rather than
// just "make this better") is the guardrail against quality-only drift.
export function buildRevisionPrompt(storyText: string, feedback: string, sourceSegmentText: string | null): string {
  const grounding = sourceSegmentText
    ? `Transcript segment it must stay true to:\n"""\n${sourceSegmentText}\n"""\n\n`
    : '';

  return `You are revising a single Agile user story so it stays strictly within what was actually said in a meeting transcript segment.

${grounding}Current story:
"""
${storyText}
"""

Problem: ${feedback}

Rewrite ONLY this one story, fixing the problem above. Do not invent any feature, condition, role, or benefit that the transcript segment doesn't support. Keep the same numbered format:

1. As a [specific role], I want [specific goal] so that [real business outcome].
   Acceptance Criteria:
   - Given [specific state], When [specific action], Then [specific measurable result]`;
}

// The comparison arm for the refinement-loop ablation: improves the story's
// quality with NO reference to a source transcript at all — deliberately the
// same "polish it" framing used by prior quality-only refinement loops
// (e.g. arXiv 2403.09442), which is exactly the condition our study expects
// to drift away from the source while quality scores rise.
export function buildQualityOnlyRevisionPrompt(storyText: string, feedback: string): string {
  return `You are revising a single Agile user story to improve its quality.

Current story:
"""
${storyText}
"""

Problem: ${feedback}

Rewrite ONLY this one story, fixing the problem above and making it as clear, complete, and well-scoped as possible. Keep the same numbered format:

1. As a [specific role], I want [specific goal] so that [real business outcome].
   Acceptance Criteria:
   - Given [specific state], When [specific action], Then [specific measurable result]`;
}

export interface BuildPromptParams {
  outputFormat: OutputFormat;
  numStories: number;
  requirements: string;
  keywords: string[];
  detectedDomain: string | null;
}

// Builds the generation prompt for the selected output format. The output text
// format here is what every downstream parser (metrics, Jira export, download)
// depends on, so changing it changes those too.
export function buildPrompt({
  outputFormat,
  numStories,
  requirements,
  keywords,
  detectedDomain,
}: BuildPromptParams): string {
  const domainContext = detectedDomain ? `This is a ${detectedDomain} domain system.` : '';

  const keywordsText =
    keywords.length > 0 ? `Prioritise these functional areas: ${keywords.join(', ')}.` : '';

  const sharedRules = `
RULES — follow all of these strictly:
1. Extract the specific user roles from the requirements (e.g. "student", "librarian", "admin"). Never use the generic word "user" — always use a specific role.
2. Each story must cover a completely distinct feature. No two stories may overlap or duplicate each other.
3. The "so that" clause must state a real business outcome or user benefit — not just restate the action (e.g. "so that I can track overdue fines across departments" not "so that I can manage fines").
4. Every acceptance criterion must be specific: include real data values, error states, or edge cases (e.g. "Given the student has 3 overdue books" not "Given the user is logged in").
5. Each story must be small enough to complete in one sprint. If a feature is too large, split it.`;

  switch (outputFormat) {
    case 'gherkin':
      return `You are an expert agile business analyst. Generate exactly ${numStories} user stories in Gherkin BDD format.
${domainContext}

Requirements:
${requirements}

${keywordsText}
${sharedRules}

Format each story exactly as:
N. Feature: [specific feature name]
   As a [specific role], I want [specific goal] so that [real business outcome].

   Scenario: [descriptive scenario name]
     Given [specific initial state with real data]
     When [specific action taken]
     Then [specific measurable result]

   Scenario: [edge case or error scenario]
     Given [specific condition]
     When [action]
     Then [expected system response]`;

    case 'invest':
      return `You are an expert agile business analyst. Generate exactly ${numStories} user stories that fully satisfy the INVEST criteria.
${domainContext}

Requirements:
${requirements}

${keywordsText}
${sharedRules}

Format each story exactly as:
N. Story: As a [specific role], I want [specific goal] so that [real business outcome].
   Independent: [explain how this story can be built and deployed without depending on other stories]
   Valuable: [explain the measurable business or user value delivered]
   Estimable: [XS / S / M / L / XL — justify the size in one sentence]
   Small: [Yes / No — if No, suggest how to split it]
   Testable: [describe exactly how QA would verify this story is complete]`;

    case 'jira':
      return `You are an expert agile business analyst. Generate exactly ${numStories} user stories in Jira-ready format.
${domainContext}

Requirements:
${requirements}

${keywordsText}
${sharedRules}

Format each story exactly as:
N. Summary: [action-oriented title under 80 characters, e.g. "Book search by ISBN with real-time availability"]
   Description: As a [specific role], I want [specific goal] so that [real business outcome].
   Acceptance Criteria:
   - Given [specific state], When [specific action], Then [specific measurable result]
   - Given [error/edge case], When [action], Then [expected system behaviour]
   Story Points: [1 / 2 / 3 / 5 / 8]
   Labels: [2–4 relevant labels from the requirements, comma-separated]`;

    default: // standard
      return `You are an expert agile business analyst. Generate exactly ${numStories} user stories.
${domainContext}

Requirements:
${requirements}

${keywordsText}
${sharedRules}

Format each story exactly as:
N. As a [specific role], I want [specific goal] so that [real business outcome].
   Acceptance Criteria:
   - Given [specific state with real data], When [specific action], Then [specific measurable result]
   - Given [error or edge case], When [action], Then [expected system behaviour]`;
  }
}
