import { NextRequest, NextResponse } from 'next/server';
import { apiRateLimiter } from '@/lib/rate-limit';
import { buildPrompt } from '@/lib/prompt-builder';
import type { OutputFormat } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Exposes the shared prompt builder over HTTP so non-browser callers (the
// batch experiment runner in particular) build the exact same prompt the
// real UI would, rather than keeping a second, driftable copy of the
// template in a standalone script.
export async function POST(req: NextRequest) {
  const rateLimitResult = await apiRateLimiter(req);
  if (rateLimitResult) return rateLimitResult;

  const body = await req.json();
  const outputFormat: OutputFormat = body.outputFormat || 'standard';
  const numStories: number = body.numStories || 5;
  const requirements: string = body.requirements || '';
  const keywords: string[] = body.keywords || [];
  const detectedDomain: string | null = body.detectedDomain ?? null;

  if (!requirements.trim()) {
    return NextResponse.json({ error: 'requirements is required' }, { status: 400 });
  }

  const prompt = buildPrompt({ outputFormat, numStories, requirements, keywords, detectedDomain });
  return NextResponse.json({ prompt });
}
