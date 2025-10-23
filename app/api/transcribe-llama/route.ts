import { NextRequest, NextResponse } from 'next/server';
import { networkInterfaces } from 'os';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Llama model configuration
const LLAMA_MODEL = process.env.LLAMA_MODEL || 'llama3.1:8b';
const LLAMA_PORT = process.env.LLAMA_PORT || '11434';

// Function to get local IP addresses
function getLocalIPs(): string[] {
  const interfaces = networkInterfaces();
  const ips: string[] = ['localhost', '127.0.0.1'];
  
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name];
    if (nets) {
      for (const net of nets) {
        if (net.family === 'IPv4' && !net.internal) {
          ips.push(net.address);
        }
      }
    }
  }
  
  return ips;
}

// Function to check if Llama is available
async function getLlamaUrl(): Promise<string | null> {
  const ips = getLocalIPs();
  
  for (const ip of ips) {
    const url = `http://${ip}:${LLAMA_PORT}`;
    try {
      const response = await fetch(`${url}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      
      if (response.ok) {
        return url;
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
}

// Check availability endpoint
export async function GET(req: NextRequest) {
  try {
    const url = await getLlamaUrl();
    
    if (url) {
      return NextResponse.json({ 
        available: true, 
        url,
        model: LLAMA_MODEL,
        message: 'Note: Most Llama models do not support audio transcription. Use Gemini for audio/video files.'
      });
    }
    
    return NextResponse.json({ 
      available: false,
      message: 'Ollama not running. Please start Ollama service.'
    });
  } catch (error) {
    console.error('Llama availability check error:', error);
    return NextResponse.json({ 
      available: false,
      message: 'Error checking Ollama availability'
    }, { status: 500 });
  }
}

// Transcribe audio endpoint
export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Get Llama URL
    const llamaUrl = await getLlamaUrl();
    
    if (!llamaUrl) {
      return NextResponse.json(
        { error: 'Ollama is not running. Please start Ollama service.' },
        { status: 503 }
      );
    }

    // Check if we're using a multimodal Llama model
    const multimodalModels = ['llava', 'bakllava', 'llama3.2-vision'];
    const isMultimodal = multimodalModels.some(model => 
      LLAMA_MODEL.toLowerCase().includes(model)
    );

    if (!isMultimodal) {
      return NextResponse.json(
        { 
          error: `Audio transcription requires a multimodal model. Current model: ${LLAMA_MODEL}`,
          suggestion: 'Install a multimodal model like llava: ollama pull llava',
          currentModel: LLAMA_MODEL
        },
        { status: 400 }
      );
    }

    // Convert file to buffer and base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Audio = buffer.toString('base64');

    console.log(`Transcribing audio with Llama (${LLAMA_MODEL})...`);

    const prompt = `Please transcribe the audio content from this file. Only provide the transcribed text, nothing else.`;

    const response = await fetch(`${llamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: LLAMA_MODEL,
        prompt: prompt,
        images: [base64Audio],
        stream: false,
        options: {
          temperature: 0.1,
        }
      }),
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Llama API error:', errorText);
      return NextResponse.json(
        { error: `Llama API error: ${response.status}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    const transcribedText = result.response || '';

    console.log('✅ Llama transcription completed');

    return NextResponse.json({ 
      text: transcribedText,
      model: LLAMA_MODEL 
    });

  } catch (error: any) {
    console.error('Llama transcription error:', error);

    if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
      return NextResponse.json(
        { error: 'Transcription timeout. Audio file might be too large.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { 
        error: error.message || 'Failed to transcribe audio with Llama',
        details: 'Please check if Ollama is running and the model supports audio transcription.'
      },
      { status: 500 }
    );
  }
}
