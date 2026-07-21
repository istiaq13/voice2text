#!/usr/bin/env node
// Batch experiment runner for the thesis study (E1/E3/E4 in
// docs/System-and-Paper-Blueprint.md). Sweeps every recording in the config
// across models x refinement modes x repeated runs, calling the app's own
// HTTP API throughout (transcribe -> build-prompt -> generate -> verify), and
// appends one CSV row per generated story as it goes, so a long unattended
// sweep survives being interrupted partway through.
//
// Usage:
//   node scripts/run-experiment.js [path/to/config.json]
// Defaults to scripts/experiment-config.example.json if no path is given —
// copy that file, point it at real recordings, and pass your copy instead.
//
// Config fields:
//   baseUrl            e.g. "http://localhost:3000" — the running dev/prod server
//   models              e.g. ["gemini", "llama"]
//   modes               e.g. ["grounded", "quality-only"]
//   runsPerCondition    repeats per (recording, model, mode) combination
//   numStories          stories requested per generation call
//   maxIterations       refinement loop cap (see verify-stories route)
//   outputCsv           where to write results (relative to the config file)
//   recordings[]        { id, audioPath, condition, domain, goldTranscriptPath? }
//                        paths are resolved relative to the config file's folder.
//                        goldTranscriptPath is optional — WER is skipped (left
//                        blank) for any recording that doesn't have one yet.

const fs = require('fs');
const path = require('path');

function normalizeForWER(text) {
  return (text.toLowerCase().match(/[a-z0-9']+/g) || []);
}

// Mirrors lib/wer.ts (kept in sync manually — see the comment there). Tested
// against known hand-worked cases before this script was written.
function computeWER(reference, hypothesis) {
  const ref = normalizeForWER(reference);
  const hyp = normalizeForWER(hypothesis);
  const n = ref.length, m = hyp.length;
  if (n === 0) return { wer: m === 0 ? 0 : Infinity, substitutions: 0, deletions: 0, insertions: m };

  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = ref[i - 1] === hyp[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }

  let substitutions = 0, deletions = 0, insertions = 0, i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ref[i - 1] === hyp[j - 1]) { i--; j--; continue; }
    const sub = i > 0 && j > 0 ? dp[i - 1][j - 1] : Infinity;
    const del = i > 0 ? dp[i - 1][j] : Infinity;
    const ins = j > 0 ? dp[i][j - 1] : Infinity;
    const best = Math.min(sub, del, ins);
    if (best === sub) { substitutions++; i--; j--; }
    else if (best === del) { deletions++; i--; }
    else { insertions++; j--; }
  }

  return { wer: (substitutions + deletions + insertions) / n, substitutions, deletions, insertions };
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const CSV_HEADER = [
  'recordingId', 'condition', 'domain', 'audioDurationSec', 'transcriptWER',
  'model', 'mode', 'run', 'storyIndex',
  'generationLatencyMs', 'verifyLatencyMs', 'iterations',
  'faithfulScore', 'qualityScore', 'faithful', 'verified',
  'formatComplete', 'readable', 'easyLanguage', 'storyText',
  // The matched transcript segment — kept alongside the story so a human
  // annotator can check traceability later without needing to re-fetch the
  // original transcript.
  'segmentId', 'segmentStart', 'segmentEnd', 'segmentText',
];

function appendCsvRow(csvPath, fields) {
  const line = CSV_HEADER.map((key) => csvEscape(fields[key])).join(',') + '\n';
  fs.appendFileSync(csvPath, line, 'utf-8');
}

const MIME_TYPES = {
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/m4a', '.ogg': 'audio/ogg',
  '.webm': 'audio/webm', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
};

async function transcribe(baseUrl, audioPath) {
  const buffer = fs.readFileSync(audioPath);
  const mimeType = MIME_TYPES[path.extname(audioPath).toLowerCase()] || 'audio/wav';
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: mimeType }), path.basename(audioPath));
  const res = await fetch(`${baseUrl}/api/transcribe-whisper`, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `transcribe-whisper failed: ${res.status}`);
  return data;
}

async function buildPromptRemote(baseUrl, requirements, numStories) {
  const res = await fetch(`${baseUrl}/api/build-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outputFormat: 'standard', numStories, requirements, keywords: [], detectedDomain: null }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `build-prompt failed: ${res.status}`);
  return data.prompt;
}

const GENERATE_ENDPOINTS = {
  gemini: '/api/generate-stories',
  groq: '/api/generate-stories-groq',
  llama: '/api/generate-stories-llama',
  qwen: '/api/generate-stories-qwen',
};

async function generateStories(baseUrl, model, prompt) {
  const start = Date.now();
  const res = await fetch(`${baseUrl}${GENERATE_ENDPOINTS[model]}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `${model} generation failed: ${res.status}`);
  return { stories: data.stories, latencyMs: Date.now() - start };
}

async function verifyStories(baseUrl, segments, stories, model, mode, maxIterations) {
  const start = Date.now();
  const res = await fetch(`${baseUrl}/api/verify-stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segments, stories, model, mode, maxIterations }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `verify-stories failed: ${res.status}`);
  return { ...data, latencyMs: Date.now() - start };
}

async function main() {
  const configPath = path.resolve(process.argv[2] || path.join(__dirname, 'experiment-config.example.json'));
  const configDir = path.dirname(configPath);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const baseUrl = config.baseUrl || 'http://localhost:3000';
  const outputCsv = path.resolve(configDir, config.outputCsv || 'experiment-results.csv');
  if (!fs.existsSync(outputCsv)) {
    fs.writeFileSync(outputCsv, CSV_HEADER.join(',') + '\n', 'utf-8');
  }

  const totalCombinations = config.recordings.length * config.models.length * config.modes.length * config.runsPerCondition;
  let done = 0;

  for (const recording of config.recordings) {
    const audioPath = path.resolve(configDir, recording.audioPath);
    console.log(`\n[transcribe] ${recording.id} (${audioPath})`);
    const transcript = await transcribe(baseUrl, audioPath);

    let wer = '';
    if (recording.goldTranscriptPath) {
      const goldPath = path.resolve(configDir, recording.goldTranscriptPath);
      const gold = fs.readFileSync(goldPath, 'utf-8');
      wer = computeWER(gold, transcript.text).wer;
    }
    console.log(`  ${transcript.segments.length} segments, ${transcript.duration.toFixed(1)}s${wer !== '' ? `, WER ${wer.toFixed(3)}` : ''}`);

    for (const model of config.models) {
      for (const mode of config.modes) {
        for (let run = 1; run <= config.runsPerCondition; run++) {
          done++;
          const label = `[${done}/${totalCombinations}] ${recording.id} · ${model} · ${mode} · run ${run}/${config.runsPerCondition}`;
          try {
            const prompt = await buildPromptRemote(baseUrl, transcript.text, config.numStories);
            const generated = await generateStories(baseUrl, model, prompt);
            const verified = await verifyStories(
              baseUrl, transcript.segments, generated.stories, model, mode, config.maxIterations
            );

            verified.results.forEach((story, idx) => {
              appendCsvRow(outputCsv, {
                recordingId: recording.id,
                condition: recording.condition,
                domain: recording.domain,
                audioDurationSec: transcript.duration,
                transcriptWER: wer,
                model, mode, run, storyIndex: idx,
                generationLatencyMs: generated.latencyMs,
                verifyLatencyMs: verified.latencyMs,
                iterations: story.iterations,
                faithfulScore: story.faithfulScore,
                qualityScore: story.qualityScore,
                faithful: story.faithful,
                verified: story.verified,
                formatComplete: story.userMetrics.formatComplete,
                readable: story.userMetrics.readable,
                easyLanguage: story.userMetrics.easyLanguage,
                storyText: story.storyText,
                segmentId: story.segmentId,
                segmentStart: story.start,
                segmentEnd: story.end,
                segmentText: transcript.segments.find((s) => s.id === story.segmentId)?.text ?? '',
              });
            });

            console.log(`  ${label}: ${verified.results.length} stories, avg faithfulness ${verified.summary.avgFaithfulScore.toFixed(2)}, avg quality ${verified.summary.avgQualityScore.toFixed(2)}`);
          } catch (err) {
            console.error(`  ${label}: FAILED — ${err.message}`);
          }
        }
      }
    }
  }

  console.log(`\nDone. Results appended to ${outputCsv}`);
}

main().catch((err) => {
  console.error('Experiment run failed:', err);
  process.exit(1);
});
