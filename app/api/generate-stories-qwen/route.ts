import { NextRequest, NextResponse } from 'next/server';
import { safeValidateStoryGenerationRequest } from '@/lib/validators';
import { apiRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen2.5:7b-instruct-q4_K_M';
const OLLAMA_BASE = process.env.LLAMA_API_URL?.replace('/api/generate', '') || 'http://localhost:11434';

const QWEN_SYSTEM =
  'You are an expert agile business analyst. Output ONLY the numbered user stories exactly as instructed. No preamble, no closing remarks, no meta-commentary.';

async function isQwenAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal });
    clearTimeout(tid);
    if (!res.ok) return false;
    const data = await res.json();
    return (data.models ?? []).some((m: { name: string }) => m.name === QWEN_MODEL);
  } catch {
    return false;
  }
}

export async function GET() {
  const available = await isQwenAvailable();
  return NextResponse.json({ available, model: QWEN_MODEL });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const rateLimitResult = await apiRateLimiter(req);
    if (rateLimitResult) return rateLimitResult;

    const body = await req.json();
    const validation = safeValidateStoryGenerationRequest(body);
    if (!validation.success || !validation.data) {
      return NextResponse.json({ error: validation.error || 'Invalid request data' }, { status: 400 });
    }

    const { prompt } = validation.data;

    if (!(await isQwenAvailable())) {
      return NextResponse.json(
        { error: `Qwen model (${QWEN_MODEL}) not found. Run: ollama pull ${QWEN_MODEL}` },
        { status: 503 }
      );
    }

    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: QWEN_MODEL,
        messages: [
          { role: 'system', content: QWEN_SYSTEM },
          { role: 'user', content: prompt },
        ],
        stream: false,
        options: { temperature: 0.5 },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) throw new Error(`Ollama error: ${response.status}`);

    const data = await response.json();
    const stories = data.message?.content || '';

    if (!stories.trim()) {
      return NextResponse.json({ error: 'No content generated. Please try again.' }, { status: 500 });
    }

    console.log(`Qwen generation completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    return NextResponse.json({ stories });
  } catch (error) {
    console.error('Qwen generation error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const status = msg.includes('timeout') || msg.includes('aborted') ? 504 :
                   msg.includes('ECONNREFUSED') ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
