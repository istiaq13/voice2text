'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  FileAudio, Loader2, AlertCircle, CheckCircle, AlertTriangle, Play, Sparkles, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/core/button';
import { Card } from '@/components/core/layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/core/form';
import { useModelAvailability } from '@/hooks/useModelAvailability';
import { buildPrompt } from '@/lib/prompt-builder';
import type { AIModel, RefinementMode, WhisperTranscriptionResponse, VerifyStoriesResponse, VerifiedStory } from '@/types';

const GENERATE_ENDPOINTS: Record<AIModel, string> = {
  gemini: '/api/generate-stories',
  groq: '/api/generate-stories-groq',
  llama: '/api/generate-stories-llama',
  qwen: '/api/generate-stories-qwen',
};

type Stage = 'idle' | 'transcribing' | 'ready' | 'generating' | 'verifying' | 'done';

function formatTime(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function StoryCard({ story, onSeek }: { story: VerifiedStory; onSeek: (t: number) => void }) {
  const firstLine = story.storyText.split('\n')[0];
  const asMatch = firstLine.match(/As a (.+?),?\s*I want (.+?),?\s*so that (.+?)\.?$/i);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            story.verified ? 'text-verified' : 'text-destructive'
          }`}
        >
          {story.verified ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {story.verified ? 'Verified' : 'Needs review'}
        </span>
        <span className="mono-chip text-xs text-muted-foreground">
          faithfulness {story.faithfulScore.toFixed(2)} · quality {story.qualityScore.toFixed(2)}
          {story.iterations > 1 && ` · ${story.iterations} attempts`}
        </span>
      </div>

      <p className="text-sm leading-relaxed">
        {asMatch ? (
          <>
            <span className="font-semibold text-primary">As a {asMatch[1]}</span>, I want{' '}
            <span className="font-medium">{asMatch[2]}</span> so that {asMatch[3]}.
          </>
        ) : (
          firstLine
        )}
      </p>

      {!story.faithful && (
        <p className="text-xs text-destructive/90">{story.reason}</p>
      )}

      <p className="mono-chip text-[11px] text-muted-foreground/80">
        USeR — format {Math.round(story.userMetrics.formatComplete * 100)}% · readable{' '}
        {Math.round(story.userMetrics.readable)} · plain language {Math.round(story.userMetrics.easyLanguage * 100)}%
      </p>

      {story.start !== null && (
        <button
          onClick={() => onSeek(story.start!)}
          className="mono-chip inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-highlight transition-colors"
        >
          <Play className="w-3 h-3" />
          {formatTime(story.start)}
        </button>
      )}
    </div>
  );
}

export function TraceStudio() {
  const models = useModelAvailability();
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<WhisperTranscriptionResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState<AIModel>('gemini');
  const [refinementMode, setRefinementMode] = useState<RefinementMode>('grounded');
  const [numStories, setNumStories] = useState(5);
  const [verified, setVerified] = useState<VerifyStoriesResponse | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setError(null);
    setTranscript(null);
    setVerified(null);
    setAudioUrl(URL.createObjectURL(file));
    setStage('transcribing');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/transcribe-whisper', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Transcription failed');
      setTranscript(data);
      setStage('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
      setStage('idle');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/*': [], 'video/*': [] },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
    disabled: stage === 'transcribing' || stage === 'generating' || stage === 'verifying',
  });

  const generateAndVerify = async () => {
    if (!transcript) return;
    setError(null);
    setVerified(null);

    try {
      setStage('generating');
      const prompt = buildPrompt({
        outputFormat: 'standard',
        numStories,
        requirements: transcript.text,
        keywords: [],
        detectedDomain: null,
      });

      const genResponse = await fetch(GENERATE_ENDPOINTS[selectedModel], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const genData = await genResponse.json();
      if (!genResponse.ok) throw new Error(genData.error || 'Story generation failed');

      setStage('verifying');
      const verifyResponse = await fetch('/api/verify-stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: transcript.segments,
          stories: genData.stories,
          model: selectedModel,
          mode: refinementMode,
        }),
      });
      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(verifyData.error || 'Verification failed');

      setVerified(verifyData);
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStage('ready');
    }
  };

  const seekTo = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      audioRef.current.play();
    }
  };

  const isBusy = stage === 'transcribing' || stage === 'generating' || stage === 'verifying';

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card className="p-6 space-y-4">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            isDragActive ? 'border-highlight bg-highlight/10' : 'border-border hover:border-highlight/60 hover:bg-accent'
          } ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          <FileAudio className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">
            {isDragActive ? 'Drop the recording here' : 'Drop a meeting recording, or click to choose one'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Audio or video · up to 100MB</p>
        </div>

        {stage === 'transcribing' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Transcribing with timestamps...
          </p>
        )}

        {audioUrl && (
          <audio ref={audioRef} src={audioUrl} controls className="w-full" />
        )}
      </Card>

      {error && (
        <Card className="p-4 border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        </Card>
      )}

      {transcript && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-medium">Transcript</h3>
              <p className="text-xs text-muted-foreground">
                {transcript.segments.length} segments · {transcript.language} ·{' '}
                {Math.round(transcript.duration)}s
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(numStories)} onValueChange={(v) => setNumStories(parseInt(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 5, 8, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} stories</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as AIModel)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Gemini</SelectItem>
                  <SelectItem value="groq" disabled={!models.groq}>Groq Llama</SelectItem>
                  <SelectItem value="llama" disabled={!models.llama}>Llama (local)</SelectItem>
                  <SelectItem value="qwen" disabled={!models.qwen}>Qwen (local)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={refinementMode} onValueChange={(v) => setRefinementMode(v as RefinementMode)}>
                <SelectTrigger className="w-40" title="Grounded checks each revision against the transcript; quality-only never sees it — useful for comparing drift">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grounded">Grounded loop</SelectItem>
                  <SelectItem value="quality-only">Quality-only loop</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={generateAndVerify} disabled={isBusy}>
                {stage === 'generating' || stage === 'verifying' ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {stage === 'generating' ? 'Generating...' : 'Verifying...'}
                  </>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Generate &amp; verify</>
                )}
              </Button>
            </div>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1 bg-background rounded-lg border border-border p-3">
            {transcript.segments.map((seg) => (
              <button
                key={seg.id}
                onClick={() => seekTo(seg.start)}
                className="block w-full text-left text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="text-highlight">{formatTime(seg.start)}</span> {seg.text}
              </button>
            ))}
          </div>
        </Card>
      )}

      {verified && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-medium">
                {verified.summary.verifiedCount} of {verified.summary.totalStories} stories verified
              </h3>
              <p className="text-xs text-muted-foreground">
                avg faithfulness {verified.summary.avgFaithfulScore.toFixed(2)} · avg quality{' '}
                {verified.summary.avgQualityScore.toFixed(2)} · judge: {verified.judgeProvider}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={generateAndVerify} disabled={isBusy}>
              <RotateCcw className="w-3.5 h-3.5 mr-2" />
              Regenerate
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {verified.results.map((story, i) => (
              <StoryCard key={i} story={story} onSeek={seekTo} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
