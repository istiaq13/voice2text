import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { safeValidateStoryGenerationRequest } from '@/lib/validators';
import { apiRateLimiter } from '@/lib/rate-limit';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Initialize Gemini AI with API key from environment variables
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error('GOOGLE_API_KEY is not set in environment variables');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimiter(req);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Check if API key is configured
    if (!apiKey || !genAI) {
      return NextResponse.json(
        { error: 'API configuration error. Please contact the administrator.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    
    // Validate request using Zod schema
    const validation = safeValidateStoryGenerationRequest(body);
    
    if (!validation.success || !validation.data) {
      return NextResponse.json(
        { error: validation.error || 'Invalid request data' },
        { status: 400 }
      );
    }

    const { prompt } = validation.data;

    // Use gemini-2.5-flash - the current free tier model available as of Oct 2025
    // This model replaced gemini-pro for free tier users
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const stories = response.text();

    if (!stories || stories.trim().length === 0) {
      return NextResponse.json(
        { error: 'No content was generated. Please try again with different requirements.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ stories });
  } catch (error) {
    console.error('Error generating user stories:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Handle specific error types
    let errorMessage = 'Failed to generate user stories';
    let statusCode = 500;

    if (error instanceof Error) {
      const errMsg = error.message.toLowerCase();
      
      if (errMsg.includes('api_key_invalid') || errMsg.includes('invalid api key')) {
        errorMessage = 'Invalid API key. Please check your Gemini API key configuration.';
        statusCode = 401;
      } else if (errMsg.includes('api key')) {
        errorMessage = 'API configuration error. Please contact support.';
        statusCode = 503;
      } else if (errMsg.includes('quota') || errMsg.includes('rate limit') || errMsg.includes('resource_exhausted')) {
        errorMessage = 'API rate limit exceeded. Please try again later.';
        statusCode = 429;
      } else if (errMsg.includes('network') || errMsg.includes('fetch') || errMsg.includes('econnrefused') || errMsg.includes('timeout')) {
        errorMessage = 'Network error connecting to Gemini API. Please check your internet connection.';
        statusCode = 503;
      } else if (errMsg.includes('permission_denied')) {
        errorMessage = 'API key does not have permission. Please verify your Gemini API key.';
        statusCode = 403;
      } else {
        // Include the actual error message for debugging
        errorMessage = `Gemini API error: ${error.message}`;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
