import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Use the API key directly
const genAI = new GoogleGenerativeAI('AIzaSyBl3DxNKn5MMo7ZXFs4qnTkC69Tzc_6y4w');

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const stories = response.text();

    return NextResponse.json({ stories });
  } catch (error) {
    console.error('Error generating user stories:', error);
    return NextResponse.json(
      { error: 'Failed to generate user stories' },
      { status: 500 }
    );
  }
}
