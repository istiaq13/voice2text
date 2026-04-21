import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { apiRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const DOMAIN_CATEGORIES = [
  'E-commerce', 'Authentication', 'Social Media', 'Analytics',
  'Project Management', 'Healthcare', 'Education', 'Communication', 'AI/ML', 'Mobile',
];

export async function POST(req: NextRequest) {
  const rateLimitResult = await apiRateLimiter(req);
  if (rateLimitResult) return rateLimitResult;

  if (!apiKey || !genAI) {
    return NextResponse.json({ error: 'API not configured' }, { status: 500 });
  }

  try {
    const { requirements } = await req.json();

    if (!requirements || requirements.length < 20) {
      return NextResponse.json({ error: 'Requirements too short' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Analyze these software requirements and identify which ONE domain category best matches from this list: ${DOMAIN_CATEGORIES.join(', ')}.

Requirements:
${requirements.substring(0, 2000)}

Respond with ONLY the category name from the list above, nothing else.`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    const domain = DOMAIN_CATEGORIES.find(
      (d) => d.toLowerCase() === raw.toLowerCase()
    ) || null;

    return NextResponse.json({ domain });
  } catch (error) {
    console.error('Domain detection error:', error);
    return NextResponse.json({ error: 'Domain detection failed' }, { status: 500 });
  }
}
