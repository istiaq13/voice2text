import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      gemini: !!process.env.GOOGLE_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      jira: !!(process.env.JIRA_BASE_URL && process.env.JIRA_API_TOKEN),
    },
  });
}
