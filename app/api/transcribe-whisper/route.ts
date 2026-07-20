import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { safeValidateFileUpload } from '@/lib/validators';
import { fileUploadRateLimiter } from '@/lib/rate-limit';
import type { WhisperTranscriptionResponse, TranscriptSegment } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const execFileAsync = promisify(execFile);

const PYTHON_BIN = process.env.WHISPER_PYTHON || 'python';
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'small';
const SCRIPT_PATH = join(process.cwd(), 'scripts', 'whisper_transcribe.py');

interface RawWhisperResult {
  engine: 'faster-whisper';
  model: string;
  language: string;
  language_probability: number;
  duration: number;
  segments: TranscriptSegment[];
  error?: string;
}

async function transcribeWithWhisper(filePath: string, language?: string): Promise<RawWhisperResult> {
  const args = [SCRIPT_PATH, filePath, '--model', WHISPER_MODEL];
  if (language) args.push('--language', language);

  const { stdout } = await execFileAsync(PYTHON_BIN, args, {
    maxBuffer: 50 * 1024 * 1024, // word-level timestamps can produce a large JSON payload
    timeout: 110_000,
  });

  const result = JSON.parse(stdout) as RawWhisperResult;
  if (result.error) throw new Error(result.error);
  return result;
}

export async function POST(req: NextRequest) {
  const rateLimitResult = await fileUploadRateLimiter(req);
  if (rateLimitResult) return rateLimitResult;

  const data = await req.formData();
  const file = data.get('file') as unknown as File;
  const language = (data.get('language') as string) || undefined;

  const validation = safeValidateFileUpload(file);
  if (!validation.success || !validation.data) {
    return NextResponse.json({ error: validation.error || 'Invalid file' }, { status: 400 });
  }

  if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
    return NextResponse.json(
      { error: 'Whisper transcription only accepts audio or video files.' },
      { status: 400 }
    );
  }

  const extension = file.name.split('.').pop() || 'bin';
  const tempPath = join(tmpdir(), `vera-whisper-${randomUUID()}.${extension}`);

  try {
    const bytes = await file.arrayBuffer();
    await writeFile(tempPath, new Uint8Array(bytes));

    const result = await transcribeWithWhisper(tempPath, language);

    if (result.segments.length === 0) {
      return NextResponse.json(
        { error: 'No speech was detected in the audio.' },
        { status: 400 }
      );
    }

    const response: WhisperTranscriptionResponse = {
      engine: result.engine,
      model: result.model,
      language: result.language,
      languageProbability: result.language_probability,
      duration: result.duration,
      text: result.segments.map((s) => s.text).join(' '),
      segments: result.segments,
      fileName: file.name,
      fileSize: file.size,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Whisper transcription error:', error);

    if (error.code === 'ENOENT') {
      return NextResponse.json(
        { error: `Python executable "${PYTHON_BIN}" was not found. Set WHISPER_PYTHON in .env.local.` },
        { status: 500 }
      );
    }
    if (error.killed || error.signal === 'SIGTERM') {
      return NextResponse.json({ error: 'Transcription timed out.' }, { status: 504 });
    }

    return NextResponse.json(
      { error: error.message || 'Whisper transcription failed' },
      { status: 500 }
    );
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

// Availability probe, mirrors the pattern used by the Ollama/Groq routes so
// the frontend can show whether local timestamped transcription is usable.
export async function GET() {
  try {
    await execFileAsync(PYTHON_BIN, ['-c', 'import faster_whisper'], { timeout: 10_000 });
    return NextResponse.json({ available: true, model: WHISPER_MODEL });
  } catch {
    return NextResponse.json({ available: false });
  }
}
