import { NextRequest, NextResponse } from 'next/server';
import { networkInterfaces } from 'os';
import { safeValidateStoryGenerationRequest } from '@/lib/validators';
import { apiRateLimiter } from '@/lib/rate-limit';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Llama model configuration
const LLAMA_MODEL = process.env.LLAMA_MODEL || 'llama3.1:8b';
const LLAMA_PORT = process.env.LLAMA_PORT || '11434';

// Function to get local IP addresses
function getLocalIPs(): string[] {
  const interfaces = networkInterfaces();
  const ips: string[] = ['localhost', '127.0.0.1', '0.0.0.0'];
  
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name];
    if (nets) {
      for (const net of nets) {
        // Include both IPv4 internal and external addresses
        if (net.family === 'IPv4') {
          ips.push(net.address);
        }
      }
    }
  }
  
  // Remove duplicates
  return Array.from(new Set(ips));
}

// Function to check if Llama is available on any of the IPs
async function checkLlamaAvailability(): Promise<{ available: boolean; url?: string }> {
  const ips = getLocalIPs();
  
  console.log('Checking Ollama on IPs:', ips);
  
  for (const ip of ips) {
    const baseUrl = `http://${ip}:${LLAMA_PORT}`;
    try {
      console.log(`Trying ${baseUrl}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout per IP
      
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`✅ Found Ollama at ${baseUrl}`);
        return { available: true, url: `${baseUrl}/api/generate` };
      }
    } catch (error) {
      console.log(`❌ Not found at ${baseUrl}`);
      // Try next IP
      continue;
    }
  }
  
  console.log('Ollama not found on any local IP');
  return { available: false };
}

export async function GET(req: NextRequest) {
  try {
    const result = await checkLlamaAvailability();
    return NextResponse.json({ 
      available: result.available,
      model: LLAMA_MODEL,
      url: result.url 
    });
  } catch (error) {
    return NextResponse.json({ available: false });
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now(); // Start timing
  
  try {
    // Apply rate limiting
    const rateLimitResult = await apiRateLimiter(req);
    if (rateLimitResult) {
      return rateLimitResult;
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

    console.log(`🦙 Generating user stories with Llama (${LLAMA_MODEL})...`);

    // Check if Llama is available and get the working URL
    const llamaCheck = await checkLlamaAvailability();
    if (!llamaCheck.available || !llamaCheck.url) {
      return NextResponse.json(
        { error: 'Llama model is not available. Please ensure Ollama is running locally.' },
        { status: 503 }
      );
    }

    // Call Llama API with the auto-detected URL
    const response = await fetch(llamaCheck.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: LLAMA_MODEL,
        prompt: prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Llama API returned status ${response.status}`);
    }

    const data = await response.json();
    const stories = data.response || '';

    if (!stories || stories.trim().length === 0) {
      return NextResponse.json(
        { error: 'No content was generated. Please try again with different requirements.' },
        { status: 500 }
      );
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(` Story generation completed - Generated ${stories.length} characters`);
    console.log(` Llama story generation took ${duration} seconds`);

    return NextResponse.json({ stories });
  } catch (error) {
    console.error('Error generating user stories with Llama:', error);

    let errorMessage = 'Failed to generate user stories with Llama';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Cannot connect to Llama. Please ensure Ollama is running on your local machine.';
        statusCode = 503;
      } else if (error.message.includes('timeout') || error.message.includes('aborted')) {
        errorMessage = 'Llama request timed out. The model might be too slow or not responding.';
        statusCode = 504;
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
