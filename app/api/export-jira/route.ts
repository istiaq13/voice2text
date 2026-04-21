import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JIRA_BASE_URL = process.env.JIRA_BASE_URL?.replace(/\/$/, '');
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY;

interface StoryBlock {
  summary: string;
  details: string[];
}

function parseStoryBlocks(text: string): StoryBlock[] {
  const lines = text.split('\n');
  const blocks: StoryBlock[] = [];
  let current: StoryBlock | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const clean = trimmed.replace(/\*\*/g, '');
    const isStory = /^(\d+[\.\)])\s/.test(clean);

    if (isStory) {
      if (current) blocks.push(current);
      const summary = clean.replace(/^(\d+[\.\)])\s/, '').substring(0, 255);
      current = { summary, details: [] };
    } else if (current) {
      current.details.push(clean);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function buildADF(summary: string, details: string[]) {
  const content: object[] = [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: summary, marks: [{ type: 'strong' }] }],
    },
  ];

  if (details.length > 0) {
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: ' ' }],
    });

    const acStart = details.findIndex(
      (d) => d.toLowerCase().includes('acceptance criteria') || d.startsWith('Given') || d.startsWith('-')
    );

    if (acStart !== -1) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: 'Acceptance Criteria:', marks: [{ type: 'strong' }] }],
      });

      const bulletItems = details
        .slice(acStart)
        .filter((d) => d.startsWith('-') || d.startsWith('Given') || d.startsWith('When') || d.startsWith('Then'))
        .map((d) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: d.replace(/^-\s*/, '') }] }],
        }));

      if (bulletItems.length > 0) {
        content.push({ type: 'bulletList', content: bulletItems });
      }
    } else {
      for (const detail of details) {
        content.push({
          type: 'paragraph',
          content: [{ type: 'text', text: detail }],
        });
      }
    }
  }

  return { type: 'doc', version: 1, content };
}

export async function POST(req: NextRequest) {
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) {
    return NextResponse.json(
      { error: 'Jira is not configured. Add JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_PROJECT_KEY to your .env.local.' },
      { status: 500 }
    );
  }

  const { stories } = await req.json();
  if (!stories || typeof stories !== 'string') {
    return NextResponse.json({ error: 'No stories provided' }, { status: 400 });
  }

  const blocks = parseStoryBlocks(stories);
  if (blocks.length === 0) {
    return NextResponse.json({ error: 'Could not parse any stories from the generated output' }, { status: 400 });
  }

  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const results: { key: string; url: string; summary: string }[] = [];
  const errors: { summary: string; error: string }[] = [];

  for (const block of blocks) {
    const body = {
      fields: {
        project: { key: JIRA_PROJECT_KEY },
        summary: block.summary,
        description: buildADF(block.summary, block.details),
        issuetype: { name: 'Story' },
      },
    };

    try {
      const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const message = err?.errors ? Object.values(err.errors).join(', ') : `HTTP ${response.status}`;
        errors.push({ summary: block.summary, error: message });
        continue;
      }

      const data = await response.json();
      results.push({
        key: data.key,
        url: `${JIRA_BASE_URL}/browse/${data.key}`,
        summary: block.summary,
      });
    } catch (e) {
      errors.push({ summary: block.summary, error: e instanceof Error ? e.message : 'Network error' });
    }
  }

  const status = results.length === 0 ? 500 : 200;
  return NextResponse.json({ results, errors, total: blocks.length }, { status });
}
