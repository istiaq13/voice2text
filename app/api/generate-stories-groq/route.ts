import { NextRequest, NextResponse } from 'next/server';
import { safeValidateStoryGenerationRequest } from '@/lib/validators';
import { apiRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_SYSTEM =
  'You are an expert agile business analyst. Output ONLY the numbered user stories exactly as instructed. No preamble, no closing remarks, no meta-commentary.';

export async function GET() {
  return NextResponse.json({ available: !!GROQ_API_KEY, model: GROQ_MODEL });
}

export async function POST(req: NextRequest) {
  const rateLimitResult = await apiRateLimiter(req);
  if (rateLimitResult) return rateLimitResult;

  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 });
  }

  const body = await req.json();
  const validation = safeValidateStoryGenerationRequest(body);
  if (!validation.success || !validation.data) {
    return NextResponse.json({ error: validation.error || 'Invalid request data' }, { status: 400 });
  }

  const { prompt } = validation.data;
  const startTime = Date.now();

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: GROQ_SYSTEM },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: err?.error?.message || `Groq API error: ${response.status}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  const stories = data.choices?.[0]?.message?.content || '';

  if (!stories.trim()) {
    return NextResponse.json({ error: 'No content generated. Please try again.' }, { status: 500 });
  }

  console.log(`✅ Groq generation completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);

  return NextResponse.json({ stories });
}
