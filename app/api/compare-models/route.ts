import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { strictRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const geminiClient = process.env.GOOGLE_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  : null;

// System instruction for Llama-based models.
// Separating role from task significantly improves instruction-following in Llama models.
// "No preamble" stops it adding "Sure! Here are your stories..." before the output.
const LLAMA_SYSTEM =
  'You are an expert agile business analyst. Output ONLY the numbered user stories exactly as instructed. No preamble, no closing remarks, no meta-commentary.';

async function runGemini(prompt: string): Promise<string> {
  if (!geminiClient) throw new Error('Gemini API key not configured');
  const model = geminiClient.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    generationConfig: { temperature: 0.4 },
  });
  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini timed out after 55s')), 55000)
    ),
  ]);
  return result.response.text();
}

async function runGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Groq API key not configured');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: LLAMA_SYSTEM },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq error: ${response.status}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function runLlama(prompt: string): Promise<string> {
  const apiUrl = process.env.LLAMA_API_URL || 'http://localhost:11434/api/generate';
  const model = process.env.LLAMA_MODEL || 'llama3.1:8b';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      system: LLAMA_SYSTEM,
      prompt,
      stream: false,
      options: { temperature: 0.5 },
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
  const data = await response.json();
  return data.response || '';
}

async function runQwen(prompt: string): Promise<string> {
  const ollamaBase = (process.env.LLAMA_API_URL || 'http://localhost:11434/api/generate').replace('/api/generate', '');
  const model = process.env.QWEN_MODEL || 'qwen2.5:7b-instruct-q4_K_M';

  const response = await fetch(`${ollamaBase}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: LLAMA_SYSTEM },
        { role: 'user', content: prompt },
      ],
      stream: false,
      options: { temperature: 0.5 },
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) throw new Error(`Ollama/Qwen error: ${response.status}`);
  const data = await response.json();
  return data.message?.content || '';
}

type ModelRunner = (prompt: string) => Promise<string>;

const RUNNERS: Record<string, ModelRunner> = {
  gemini: runGemini,
  groq: runGroq,
  llama: runLlama,
  qwen: runQwen,
};

interface RunResult {
  stories: string;
  responseTime: number;
  error: string | null;
}

export async function POST(req: NextRequest) {
  const rateLimitResult = await strictRateLimiter(req);
  if (rateLimitResult) return rateLimitResult;

  const { prompt, models, runs = 1 } = await req.json() as {
    prompt: string;
    models: string[];
    runs?: number;
  };

  if (!prompt || !models?.length) {
    return NextResponse.json({ error: 'prompt and models are required' }, { status: 400 });
  }

  const clampedRuns = Math.min(Math.max(Number(runs) || 1, 1), 5);

  // Run all (model × run) combinations in parallel for minimum total time
  const tasks = models.flatMap((model) =>
    Array.from({ length: clampedRuns }, (_, runIndex) => ({ model, runIndex }))
  );

  const settled = await Promise.allSettled(
    tasks.map(async ({ model, runIndex }) => {
      const runner = RUNNERS[model];
      if (!runner) throw new Error(`Unknown model: ${model}`);
      const start = Date.now();
      const stories = await runner(prompt);
      return { model, runIndex, stories, responseTime: Date.now() - start, error: null };
    })
  );

  // Group runs by model
  const byModel: Record<string, RunResult[]> = {};
  for (const model of models) byModel[model] = [];

  settled.forEach((result, i) => {
    const model = tasks[i].model;
    if (result.status === 'fulfilled') {
      byModel[model].push({ stories: result.value.stories, responseTime: result.value.responseTime, error: null });
    } else {
      byModel[model].push({
        stories: '',
        responseTime: 0,
        error: result.reason instanceof Error ? result.reason.message : 'Failed',
      });
    }
  });

  const output = models.map((model) => ({
    model,
    runs: byModel[model],
  }));

  return NextResponse.json({ results: output, runsRequested: clampedRuns });
}
