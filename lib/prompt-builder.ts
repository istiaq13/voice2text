import type { OutputFormat } from '@/types';

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
