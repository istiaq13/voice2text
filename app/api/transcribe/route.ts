import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Initialize Gemini AI with API key from environment variables
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error('GOOGLE_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['audio/', 'video/'];
    const isValidType = validTypes.some(type => audioFile.type.startsWith(type));
    
    if (!isValidType) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an audio or video file.' },
        { status: 400 }
      );
    }

    // Validate file size (max 25MB)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: `File too large (${(audioFile.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 25MB.` },
        { status: 400 }
      );
    }

    if (audioFile.size === 0) {
      return NextResponse.json(
        { error: 'File is empty. Please upload a valid file.' },
        { status: 400 }
      );
    }

    // Use gemini-2.5-flash for multimodal tasks (supports audio, video, images)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
    });

    // Convert file to base64
    const bytes = await audioFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64,
          mimeType: audioFile.type
        }
      },
      'Please transcribe this audio or video file and return only the text content. Extract all spoken words accurately.'
    ]);

    const transcription = result.response.text();

    if (!transcription || transcription.trim().length === 0) {
      return NextResponse.json(
        { error: 'No speech detected in the audio. Please ensure the file contains clear speech.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ transcription });
  } catch (error) {
    console.error('Error transcribing audio:', error);
    
    // Handle specific error types
    let errorMessage = 'Failed to transcribe audio';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'API configuration error. Please contact support.';
        statusCode = 503;
      } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
        errorMessage = 'API rate limit exceeded. Please try again later.';
        statusCode = 429;
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
        statusCode = 503;
      } else if (error.message.includes('format') || error.message.includes('codec')) {
        errorMessage = 'Unsupported audio format. Please try a different file.';
        statusCode = 400;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}