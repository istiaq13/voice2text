import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import mammoth from 'mammoth';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Initialize Gemini AI
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  throw new Error('GOOGLE_API_KEY is not set in environment variables');
}
const genAI = new GoogleGenerativeAI(apiKey);

// File type categories
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/webm'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/avi'];
const DOCUMENT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown'
};

// Helper to determine file category
function getFileCategory(mimeType: string): 'audio' | 'video' | 'document' | 'unknown' {
  if (AUDIO_TYPES.includes(mimeType)) return 'audio';
  if (VIDEO_TYPES.includes(mimeType)) return 'video';
  if (Object.values(DOCUMENT_TYPES).includes(mimeType)) return 'document';
  return 'unknown';
}

// Extract text from PDF using Gemini AI (more reliable than pdf-parse)
async function extractFromPDF(buffer: Buffer): Promise<string> {
  try {
    console.log('Starting PDF extraction with Gemini AI, buffer size:', buffer.length);
    
    // Validate buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('PDF buffer is empty');
    }

    // Check if buffer starts with PDF magic number
    const pdfHeader = buffer.toString('utf-8', 0, 5);
    if (!pdfHeader.startsWith('%PDF-')) {
      console.error('Invalid PDF header:', pdfHeader);
      throw new Error('File does not appear to be a valid PDF');
    }

    // Use Gemini AI to extract text from PDF (supports multimodal input)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const base64 = buffer.toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64,
          mimeType: 'application/pdf'
        }
      },
      'Extract all text content from this PDF document. Return only the extracted text, preserving the structure and formatting as much as possible. Do not add any commentary or explanations.'
    ]);

    const extractedText = result.response.text();
    
    console.log('✅ PDF text extracted successfully');
    console.log('📝 Text length:', extractedText?.length || 0);
    
    if (!extractedText || extractedText.trim().length === 0) {
      console.warn('⚠️ PDF processed but contains no extractable text');
      return 'This PDF appears to be image-based or contains no extractable text. Please try a text-based PDF or use OCR.';
    }
    
    return extractedText;
  } catch (error: any) {
    console.error('PDF extraction error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Provide more specific error messages
    if (error.message?.includes('encrypted') || error.message?.includes('password')) {
      throw new Error('This PDF is password-protected. Please provide an unprotected PDF.');
    }
    if (error.message?.includes('API key')) {
      throw new Error('Gemini API error. Please check your API key configuration.');
    }
    if (error.message?.includes('quota')) {
      throw new Error('API quota exceeded. Please try again later.');
    }
    
    throw new Error(`PDF text extraction failed: ${error.message}`);
  }
}

// Extract text from DOCX
async function extractFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Failed to extract text from Word document');
  }
}

// Extract text from plain text files
async function extractFromText(buffer: Buffer): Promise<string> {
  try {
    return buffer.toString('utf-8');
  } catch (error) {
    console.error('Text extraction error:', error);
    throw new Error('Failed to extract text from file');
  }
}

// Transcribe audio/video using Gemini
async function transcribeAudioVideo(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const base64 = buffer.toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64,
          mimeType: mimeType
        }
      },
      'Please transcribe this audio or video file and return only the text content. Extract all spoken words accurately.'
    ]);

    return result.response.text();
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error('Failed to transcribe audio/video');
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;
    const model: string = data.get('model') as string || 'gemini'; // For audio/video transcription

    // Validation
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: 'File is empty. Please upload a valid file.' },
        { status: 400 }
      );
    }

    // 100MB limit
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 100MB' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine file type and extract text accordingly
    const fileCategory = getFileCategory(file.type);
    let extractedText = '';
    let processingMethod = '';

    console.log(`Processing file: ${file.name} (${file.type}) - Category: ${fileCategory}`);

    switch (fileCategory) {
      case 'document':
        processingMethod = 'Document Text Extraction';
        if (file.type === DOCUMENT_TYPES.pdf) {
          extractedText = await extractFromPDF(buffer);
        } else if (file.type === DOCUMENT_TYPES.docx) {
          extractedText = await extractFromDOCX(buffer);
        } else if (file.type === DOCUMENT_TYPES.txt || file.type === DOCUMENT_TYPES.md) {
          extractedText = await extractFromText(buffer);
        }
        break;

      case 'audio':
      case 'video':
        processingMethod = model === 'llama' ? 'Llama Transcription' : 'Gemini Transcription';
        
        if (model === 'llama') {
          // Forward to Llama transcription route
          const llamaFormData = new FormData();
          llamaFormData.append('file', file);
          
          const llamaResponse = await fetch(`${req.nextUrl.origin}/api/transcribe-llama`, {
            method: 'POST',
            body: llamaFormData,
          });

          if (!llamaResponse.ok) {
            const error = await llamaResponse.json();
            throw new Error(error.error || 'Llama transcription failed');
          }

          const llamaData = await llamaResponse.json();
          extractedText = llamaData.text;
        } else {
          // Use Gemini transcription
          extractedText = await transcribeAudioVideo(buffer, file.type);
        }
        break;

      case 'unknown':
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}` },
          { status: 400 }
        );
    }

    // Validation of extracted text
    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        { 
          error: 'No text was extracted from the file. The file might be empty or corrupted.',
          method: processingMethod 
        },
        { status: 400 }
      );
    }

    console.log(`✅ Successfully extracted ${extractedText.length} characters using ${processingMethod}`);

    return NextResponse.json({
      text: extractedText,
      method: processingMethod,
      fileType: fileCategory,
      fileName: file.name,
      fileSize: file.size,
      characterCount: extractedText.length
    });

  } catch (error: any) {
    console.error('Text extraction error:', error);

    // Specific error handling
    if (error.message?.includes('PDF')) {
      return NextResponse.json(
        { error: 'Failed to read PDF. The file might be corrupted or password-protected.' },
        { status: 400 }
      );
    }

    if (error.message?.includes('DOCX') || error.message?.includes('Word')) {
      return NextResponse.json(
        { error: 'Failed to read Word document. The file might be corrupted or in an unsupported format.' },
        { status: 400 }
      );
    }

    if (error.message?.includes('timeout')) {
      return NextResponse.json(
        { error: 'Processing timeout. The file might be too large or complex.' },
        { status: 504 }
      );
    }

    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { error: 'API key error. Please check your Gemini API configuration.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { 
        error: error.message || 'Failed to extract text from file',
        details: 'Please ensure the file is not corrupted and is in a supported format.'
      },
      { status: 500 }
    );
  }
}
