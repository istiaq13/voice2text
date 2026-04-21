'use client';

import React, { useState } from 'react';
import { Loader2, AlertCircle, X, BarChart2, Download, CheckCircle, Play } from 'lucide-react';
import { Card } from '@/components/core/layout';
import { Button } from '@/components/core/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/core/form';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoryBlock { storyLine: string; details: string[] }

interface Metrics {
  total: number;
  formatCompliance: number;
  roleSpecificity: number;
  acCoverage: number;
  uniqueness: number;
  avgWordCount: number;
  overallScore: number;
}

interface RunResult { stories: string; responseTime: number; error: string | null }

interface PerModelState {
  status: 'running' | 'done' | 'error';
  completedRuns: number;
  runs: RunResult[];
}

interface AggregatedResult {
  model: string;
  avgMetrics: Metrics;
  avgResponseTime: number;
  bestStories: string;
  successfulRuns: number;
  totalRuns: number;
  error: string | null;
}

interface Props {
  prompt: string;
  availableModels: { gemini: boolean; groq: boolean; llama: boolean; qwen: boolean };
  onClose: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_MODELS = ['gemini', 'groq', 'llama', 'qwen'] as const;

const MODEL_META: Record<string, { label: string; provider: string; color: string; bg: string; border: string; chartColor: string; dot: string }> = {
  gemini: { label: 'Gemini 2.0 Flash', provider: 'Google', color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-950',     border: 'border-blue-200 dark:border-blue-800',   chartColor: '#3b82f6', dot: 'bg-blue-500' },
  groq:   { label: 'Llama 3.3 70B',    provider: 'Groq',   color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-200 dark:border-orange-800', chartColor: '#f97316', dot: 'bg-orange-500' },
  llama:  { label: 'Llama 3.1 8B',     provider: 'Ollama', color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-50 dark:bg-green-950',   border: 'border-green-200 dark:border-green-800',  chartColor: '#22c55e', dot: 'bg-green-500' },
  qwen:   { label: 'Qwen 2.5 7B',      provider: 'Ollama', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950', border: 'border-purple-200 dark:border-purple-800', chartColor: '#a855f7', dot: 'bg-purple-500' },
};

const MODEL_ENDPOINTS: Record<string, string> = {
  gemini: '/api/generate-stories',
  groq:   '/api/generate-stories-groq',
  llama:  '/api/generate-stories-llama',
  qwen:   '/api/generate-stories-qwen',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseBlocks(text: string): StoryBlock[] {
  const blocks: StoryBlock[] = [];
  let current: StoryBlock | null = null;
  for (const line of text.split('\n')) {
    const clean = line.trim().replace(/\*\*/g, '');
    if (!clean) continue;
    if (/^(\d+[\.\)])\s/.test(clean)) {
      if (current) blocks.push(current);
      current = { storyLine: clean, details: [] };
    } else if (current) {
      current.details.push(clean);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function calcMetrics(stories: string): Metrics {
  const blocks = parseBlocks(stories);
  if (!blocks.length) return { total: 0, formatCompliance: 0, roleSpecificity: 0, acCoverage: 0, uniqueness: 0, avgWordCount: 0, overallScore: 0 };

  const formatRe  = /As a .+,?\s*I want .+,?\s*so that .+/i;
  const genericRe = /As a\s+user\b/i;
  const acRe      = /Given|When|Then/i;

  let formatOk = 0, roleOk = 0, acOk = 0, totalWords = 0;
  const fingerprints: string[] = [];
  let uniqueOk = 0;

  for (const b of blocks) {
    const text = b.storyLine + ' ' + b.details.join(' ');
    if (formatRe.test(text)) formatOk++;
    if (!genericRe.test(b.storyLine)) roleOk++;
    if (b.details.some(d => acRe.test(d))) acOk++;
    totalWords += b.storyLine.split(/\s+/).length;
    const words = b.storyLine.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 4);
    const fp = words.slice(0, 4).join('-');
    if (!fingerprints.some(f => fp.split('-').filter(w => f.includes(w)).length >= 2)) uniqueOk++;
    fingerprints.push(fp);
  }

  const n = blocks.length;
  const formatCompliance = Math.round((formatOk / n) * 100);
  const roleSpecificity  = Math.round((roleOk  / n) * 100);
  const acCoverage       = Math.round((acOk    / n) * 100);
  const uniqueness       = Math.round((uniqueOk / n) * 100);
  const avgWordCount     = Math.round(totalWords / n);
  const overallScore     = Math.round((formatCompliance + roleSpecificity + acCoverage + uniqueness) / 4);
  return { total: n, formatCompliance, roleSpecificity, acCoverage, uniqueness, avgWordCount, overallScore };
}

function avgMetricsAcrossRuns(runs: RunResult[]): Metrics {
  const ok = runs.filter(r => r.stories && !r.error);
  if (!ok.length) return { total: 0, formatCompliance: 0, roleSpecificity: 0, acCoverage: 0, uniqueness: 0, avgWordCount: 0, overallScore: 0 };
  const all = ok.map(r => calcMetrics(r.stories));
  const avg = (k: keyof Metrics) => Math.round(all.reduce((s, m) => s + (m[k] as number), 0) / all.length);
  return {
    total: avg('total'), formatCompliance: avg('formatCompliance'), roleSpecificity: avg('roleSpecificity'),
    acCoverage: avg('acCoverage'), uniqueness: avg('uniqueness'), avgWordCount: avg('avgWordCount'), overallScore: avg('overallScore'),
  };
}

function bestRun(runs: RunResult[]): RunResult | null {
  const ok = runs.filter(r => r.stories && !r.error);
  if (!ok.length) return null;
  return ok.reduce((best, r) => calcMetrics(r.stories).overallScore > calcMetrics(best.stories).overallScore ? r : best);
}

function toAggregated(model: string, state: PerModelState, totalRuns: number): AggregatedResult {
  const ok = state.runs.filter(r => !r.error && r.stories);
  const best = bestRun(state.runs);
  const avgTime = ok.length ? Math.round(ok.reduce((s, r) => s + r.responseTime, 0) / ok.length) : 0;
  return {
    model,
    avgMetrics: avgMetricsAcrossRuns(state.runs),
    avgResponseTime: avgTime,
    bestStories: best?.stories || '',
    successfulRuns: ok.length,
    totalRuns,
    error: state.status === 'error' ? (state.runs.find(r => r.error)?.error || 'Failed') : null,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBadge({ value, label }: { value: number; label: string }) {
  const color =
    value >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
    value >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                  'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
  return (
    <div className="text-center">
      <div className={`text-sm font-bold px-2 py-1 rounded-lg ${color}`}>{value}%</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function TimeBadge({ ms }: { ms: number }) {
  const secs = (ms / 1000).toFixed(1);
  const color = ms < 3000 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                ms < 10000 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                             'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
  return (
    <div className="text-center">
      <div className={`text-sm font-bold px-2 py-1 rounded-lg font-mono ${color}`}>{secs}s</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Avg time</div>
    </div>
  );
}

function OverallBadge({ value }: { value: number }) {
  const grad = value >= 80 ? 'from-green-500 to-emerald-600' : value >= 50 ? 'from-yellow-500 to-orange-500' : 'from-red-500 to-rose-600';
  return (
    <div className={`text-center px-3 py-2 rounded-lg bg-gradient-to-r ${grad} text-white`}>
      <div className="text-2xl font-bold">{value}%</div>
      <div className="text-xs opacity-90">Overall</div>
    </div>
  );
}

function SkeletonBar({ width = 'w-full' }: { width?: string }) {
  return <div className={`${width} h-3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse`} />;
}

function ModelLoadingCard({ model, state, totalRuns }: { model: string; state: PerModelState; totalRuns: number }) {
  const meta = MODEL_META[model] ?? { label: model, provider: '', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', chartColor: '#6b7280', dot: 'bg-gray-400' };
  const pct = totalRuns > 0 ? Math.round((state.completedRuns / totalRuns) * 100) : 0;
  return (
    <div className="rounded-xl border overflow-hidden border-gray-200 dark:border-gray-700">
      <div className={`p-4 ${meta.bg} ${meta.border} border-b`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`font-semibold ${meta.color}`}>{meta.label}</div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{meta.provider}</span>
          </div>
          <Loader2 className={`w-4 h-4 animate-spin ${meta.color}`} />
        </div>
      </div>
      <div className="p-4 bg-white dark:bg-gray-900 space-y-3">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{state.completedRuns === 0 ? 'Starting...' : `Run ${state.completedRuns} of ${totalRuns} complete`}</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: meta.chartColor }} />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-1"><SkeletonBar /><SkeletonBar width="w-2/3" /></div>
          ))}
        </div>
        <div className="space-y-2 pt-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-1"><SkeletonBar /><SkeletonBar width="w-4/5" /></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(aggregated: AggregatedResult[], runs: number) {
  const headers = ['Model', 'Provider', 'Runs', 'Avg Response (ms)', 'Format %', 'Role %', 'AC %', 'Uniqueness %', 'Avg Words/Story', 'Overall %'];
  const rows = aggregated.map(a => {
    const meta = MODEL_META[a.model];
    return [meta?.label ?? a.model, meta?.provider ?? '', `${a.successfulRuns}/${runs}`, a.avgResponseTime,
      a.avgMetrics.formatCompliance, a.avgMetrics.roleSpecificity, a.avgMetrics.acCoverage,
      a.avgMetrics.uniqueness, a.avgMetrics.avgWordCount, a.avgMetrics.overallScore];
  });
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `model_comparison_${runs}runs_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ModelComparison({ prompt, availableModels, onClose }: Props) {
  const [phase, setPhase] = useState<'setup' | 'running' | 'done'>('setup');
  const [runs, setRuns] = useState(1);
  const [selectedModels, setSelectedModels] = useState<string[]>(
    ALL_MODELS.filter(m => availableModels[m])
  );
  const [modelStates, setModelStates] = useState<Record<string, PerModelState>>({});
  const [isRunning, setIsRunning] = useState(false);

  function toggleModel(model: string) {
    setSelectedModels(prev =>
      prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
    );
  }

  async function startComparison() {
    if (selectedModels.length < 1) return;
    setPhase('running');
    setIsRunning(true);

    const initial: Record<string, PerModelState> = {};
    for (const m of selectedModels) initial[m] = { status: 'running', completedRuns: 0, runs: [] };
    setModelStates(initial);

    await Promise.all(selectedModels.map(async (model) => {
      const endpoint = MODEL_ENDPOINTS[model] ?? '/api/generate-stories';
      const accRuns: RunResult[] = [];

      for (let i = 0; i < runs; i++) {
        const start = Date.now();
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
          });
          const data = await res.json().catch(() => ({})) as { stories?: string; error?: string };
          accRuns.push({
            stories: res.ok ? (data.stories || '') : '',
            responseTime: Date.now() - start,
            error: res.ok ? null : (data.error || `HTTP ${res.status}`),
          });
        } catch (e) {
          accRuns.push({ stories: '', responseTime: Date.now() - start, error: e instanceof Error ? e.message : 'Network error' });
        }

        const completed = i + 1;
        const allFailed = accRuns.every(r => r.error);
        setModelStates(prev => ({
          ...prev,
          [model]: {
            status: completed === runs ? (allFailed ? 'error' : 'done') : 'running',
            completedRuns: completed,
            runs: [...accRuns],
          },
        }));
      }
    }));

    setIsRunning(false);
    setPhase('done');
  }

  function rerun() {
    setPhase('setup');
    setModelStates({});
  }

  const doneModels = selectedModels.filter(m => modelStates[m]?.status === 'done' || modelStates[m]?.status === 'error');
  const aggregated = doneModels.map(m => toAggregated(m, modelStates[m], runs));
  const completedOk = aggregated.filter(a => !a.error);

  const winner = completedOk.length
    ? completedOk.reduce<AggregatedResult | null>((best, a) =>
        !best || a.avgMetrics.overallScore > best.avgMetrics.overallScore ? a : best, null)
    : null;

  const gridCols =
    selectedModels.length === 1 ? 'grid-cols-1' :
    selectedModels.length === 2 ? 'md:grid-cols-2' :
    selectedModels.length === 3 ? 'md:grid-cols-3' :
    'md:grid-cols-2 xl:grid-cols-4';

  return (
    <Card className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Model Comparison</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {phase === 'setup' ? 'Select models and runs, then start' :
               phase === 'running' ? `Running ${selectedModels.length} models in parallel…` :
               `${selectedModels.length} models · ${runs > 1 ? `${runs}-run average` : '1 run'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {phase === 'done' && (
            <>
              {completedOk.length > 0 && (
                <Button onClick={() => exportCSV(completedOk, runs)} size="sm" variant="outline">
                  <Download className="w-4 h-4 mr-1" /> CSV
                </Button>
              )}
              <Button onClick={rerun} size="sm" variant="outline">Re-configure</Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={onClose} disabled={isRunning}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── SETUP PHASE ── */}
      {phase === 'setup' && (
        <div className="space-y-6">
          {/* Model selection */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Models to compare</p>
            <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {ALL_MODELS.map(model => {
                const meta = MODEL_META[model];
                const available = availableModels[model];
                const selected  = selectedModels.includes(model);
                return (
                  <button
                    key={model}
                    onClick={() => available && toggleModel(model)}
                    disabled={!available}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors
                      ${available ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer' : 'opacity-40 cursor-not-allowed bg-gray-50 dark:bg-gray-900'}
                      ${selected && available ? meta.bg : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox */}
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                        ${selected && available ? 'border-gray-900 dark:border-white bg-gray-900 dark:bg-white' : 'border-gray-300 dark:border-gray-600'}`}>
                        {selected && available && (
                          <svg className="w-2.5 h-2.5 text-white dark:text-gray-900" fill="currentColor" viewBox="0 0 12 12">
                            <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          </svg>
                        )}
                      </div>
                      {/* Color dot */}
                      <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
                      <div>
                        <span className={`text-sm font-medium ${selected && available ? meta.color : 'text-gray-700 dark:text-gray-300'}`}>
                          {meta.label}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">{meta.provider}</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      available
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                    }`}>
                      {available ? 'ready' : 'not available'}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedModels.length < 2 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Select at least 2 models to compare.</p>
            )}
          </div>

          {/* Runs selector */}
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Runs per model:</p>
            <div className="flex gap-2">
              {[1, 3, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setRuns(n)}
                  className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${
                    runs === n
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white font-medium'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {n}×
                </button>
              ))}
            </div>
            {runs > 1 && (
              <span className="text-xs text-gray-400">scores averaged for reliability</span>
            )}
          </div>

          {/* Start button */}
          <Button
            onClick={startComparison}
            disabled={selectedModels.length < 2}
            className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 font-medium"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Comparison · {selectedModels.length} models × {runs} {runs === 1 ? 'run' : 'runs'}
          </Button>
        </div>
      )}

      {/* ── RUNNING PHASE ── */}
      {phase === 'running' && (
        <>
          {/* Status pills */}
          <div className="flex flex-wrap gap-2">
            {selectedModels.map(m => {
              const s = modelStates[m];
              const meta = MODEL_META[m];
              const isDone = s?.status === 'done' || s?.status === 'error';
              return (
                <div key={m} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                  isDone ? `${meta?.bg} ${meta?.border} ${meta?.color}` : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'
                }`}>
                  {isDone ? <CheckCircle className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
                  {meta?.label}
                  {runs > 1 && s && <span className="opacity-60">{s.completedRuns}/{runs}</span>}
                </div>
              );
            })}
          </div>

          {/* Model cards */}
          <div className={`grid gap-4 ${gridCols}`}>
            {selectedModels.map(model => {
              const state = modelStates[model];
              if (!state || state.status === 'running') {
                return <ModelLoadingCard key={model} model={model} state={state ?? { status: 'running', completedRuns: 0, runs: [] }} totalRuns={runs} />;
              }
              return <ResultCard key={model} model={model} state={state} runs={runs} winner={null} />;
            })}
          </div>
        </>
      )}

      {/* ── DONE PHASE ── */}
      {phase === 'done' && (
        <>
          {/* Model result cards */}
          <div className={`grid gap-4 ${gridCols}`}>
            {selectedModels.map(model => {
              const state = modelStates[model];
              if (!state) return null;
              return <ResultCard key={model} model={model} state={state} runs={runs} winner={winner} />;
            })}
          </div>

          {/* Charts — show once ≥2 successful */}
          {completedOk.length >= 2 && (() => {
            const barData = [
              { metric: 'Format',  ...Object.fromEntries(completedOk.map(a => [MODEL_META[a.model]?.label ?? a.model, a.avgMetrics.formatCompliance])) },
              { metric: 'Roles',   ...Object.fromEntries(completedOk.map(a => [MODEL_META[a.model]?.label ?? a.model, a.avgMetrics.roleSpecificity])) },
              { metric: 'AC',      ...Object.fromEntries(completedOk.map(a => [MODEL_META[a.model]?.label ?? a.model, a.avgMetrics.acCoverage])) },
              { metric: 'Unique',  ...Object.fromEntries(completedOk.map(a => [MODEL_META[a.model]?.label ?? a.model, a.avgMetrics.uniqueness])) },
              { metric: 'Overall', ...Object.fromEntries(completedOk.map(a => [MODEL_META[a.model]?.label ?? a.model, a.avgMetrics.overallScore])) },
            ];
            const radarData = [
              { metric: 'Format', ...Object.fromEntries(completedOk.map(a => [MODEL_META[a.model]?.label ?? a.model, a.avgMetrics.formatCompliance])) },
              { metric: 'Roles',  ...Object.fromEntries(completedOk.map(a => [MODEL_META[a.model]?.label ?? a.model, a.avgMetrics.roleSpecificity])) },
              { metric: 'AC',     ...Object.fromEntries(completedOk.map(a => [MODEL_META[a.model]?.label ?? a.model, a.avgMetrics.acCoverage])) },
              { metric: 'Unique', ...Object.fromEntries(completedOk.map(a => [MODEL_META[a.model]?.label ?? a.model, a.avgMetrics.uniqueness])) },
              { metric: 'Speed',  ...Object.fromEntries(completedOk.map(a => {
                const maxT = Math.max(...completedOk.map(x => x.avgResponseTime)) || 1;
                return [MODEL_META[a.model]?.label ?? a.model, Math.round(100 - (a.avgResponseTime / maxT) * 100)];
              })) },
            ];
            return (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Quality Metrics</h4>
                  {runs > 1 && <p className="text-xs text-gray-400 mb-3">{runs}-run averaged scores</p>}
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Legend />
                      {completedOk.map(a => (
                        <Bar key={a.model} dataKey={MODEL_META[a.model]?.label ?? a.model} fill={MODEL_META[a.model]?.chartColor ?? '#6b7280'} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Overall Profile</h4>
                  {runs > 1 && <p className="text-xs text-gray-400 mb-3">Speed = inverse of avg response time</p>}
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                      {completedOk.map(a => (
                        <Radar key={a.model} name={MODEL_META[a.model]?.label ?? a.model}
                          dataKey={MODEL_META[a.model]?.label ?? a.model}
                          stroke={MODEL_META[a.model]?.chartColor ?? '#6b7280'}
                          fill={MODEL_META[a.model]?.chartColor ?? '#6b7280'}
                          fillOpacity={0.15} strokeWidth={2} />
                      ))}
                      <Legend />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          {/* Summary scorecard */}
          {aggregated.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                  Summary Scorecard {runs > 1 && <span className="text-gray-400 font-normal">({runs}-run average)</span>}
                </h4>
                {completedOk.length > 0 && (
                  <Button onClick={() => exportCSV(completedOk, runs)} size="sm" variant="outline" className="text-xs">
                    <Download className="w-3 h-3 mr-1" /> Export CSV
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left px-4 py-2 text-gray-500 dark:text-gray-400 font-medium">Metric</th>
                      {aggregated.map(a => (
                        <th key={a.model} className={`text-center px-4 py-2 font-medium ${winner?.model === a.model ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                          <span className="flex items-center justify-center gap-2">
                            {MODEL_META[a.model]?.label ?? a.model}
                            {winner?.model === a.model && <span className="text-xs bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-1.5 py-0.5 rounded font-medium tracking-wide">BEST</span>}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'responseTime',     label: 'Avg Response Time', fmt: (a: AggregatedResult) => a.error ? '—' : `${(a.avgResponseTime / 1000).toFixed(2)}s` },
                      { key: 'formatCompliance', label: 'Format Compliance', fmt: (a: AggregatedResult) => a.error ? '—' : `${a.avgMetrics.formatCompliance}%` },
                      { key: 'roleSpecificity',  label: 'Role Specificity',  fmt: (a: AggregatedResult) => a.error ? '—' : `${a.avgMetrics.roleSpecificity}%` },
                      { key: 'acCoverage',       label: 'AC Coverage',       fmt: (a: AggregatedResult) => a.error ? '—' : `${a.avgMetrics.acCoverage}%` },
                      { key: 'uniqueness',       label: 'Story Uniqueness',  fmt: (a: AggregatedResult) => a.error ? '—' : `${a.avgMetrics.uniqueness}%` },
                      { key: 'avgWordCount',     label: 'Avg Words / Story', fmt: (a: AggregatedResult) => a.error ? '—' : `${a.avgMetrics.avgWordCount}` },
                      { key: 'overallScore',     label: 'Overall Score',     fmt: (a: AggregatedResult) => a.error ? '—' : `${a.avgMetrics.overallScore}%` },
                    ].map(row => (
                      <tr key={row.key} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium">{row.label}</td>
                        {aggregated.map(a => {
                          const isWinnerCell = winner?.model === a.model && !a.error;
                          return (
                            <td key={a.model} className={`px-4 py-2 text-center font-mono ${isWinnerCell ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                              {row.fmt(a)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Metric legend */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-500 dark:text-gray-400">
            <div><span className="font-medium text-gray-700 dark:text-gray-300">Format</span> — "As a X, I want Y so that Z" compliance</div>
            <div><span className="font-medium text-gray-700 dark:text-gray-300">Roles</span> — specific roles used (not generic "user")</div>
            <div><span className="font-medium text-gray-700 dark:text-gray-300">AC</span> — stories with Given/When/Then criteria</div>
            <div><span className="font-medium text-gray-700 dark:text-gray-300">Unique</span> — stories covering distinct features</div>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Result Card (extracted to avoid duplication) ─────────────────────────────

function ResultCard({ model, state, runs, winner }: { model: string; state: PerModelState; runs: number; winner: AggregatedResult | null }) {
  const a = toAggregated(model, state, runs);
  const meta = MODEL_META[model] ?? { label: model, provider: '', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', chartColor: '#6b7280', dot: 'bg-gray-400' };
  const blocks = a.bestStories ? parseBlocks(a.bestStories) : [];
  const isWinner = winner?.model === model;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${isWinner ? 'border-gray-900 dark:border-gray-300' : 'border-gray-200 dark:border-gray-700'}`}>
      {/* Header */}
      <div className={`p-4 ${meta.bg} ${meta.border} border-b`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${meta.color}`}>{meta.label}</span>
              {isWinner && <span className="text-xs bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-2 py-0.5 rounded font-medium tracking-wide">BEST</span>}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{meta.provider}</span>
          </div>
          <div className="text-right">
            {a.error ? (
              <span className="text-xs text-red-500 font-medium">Failed</span>
            ) : (
              <>
                <div className="text-xs font-mono text-gray-600 dark:text-gray-400">{(a.avgResponseTime / 1000).toFixed(2)}s avg</div>
                {runs > 1 && <div className="text-xs text-gray-400">{a.successfulRuns}/{a.totalRuns} runs ok</div>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Metrics */}
      {!a.error && (
        <div className="p-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-around gap-2">
            <OverallBadge value={a.avgMetrics.overallScore} />
            <div className="flex-1 grid grid-cols-2 gap-2">
              <ScoreBadge value={a.avgMetrics.formatCompliance} label="Format" />
              <ScoreBadge value={a.avgMetrics.roleSpecificity}  label="Roles" />
              <ScoreBadge value={a.avgMetrics.acCoverage}       label="AC" />
              <ScoreBadge value={a.avgMetrics.uniqueness}        label="Unique" />
            </div>
            <TimeBadge ms={a.avgResponseTime} />
          </div>
          <div className="mt-2 text-center text-xs text-gray-400">
            {a.avgMetrics.avgWordCount} words/story
            {runs > 1 && <span className="ml-2">· {runs}-run avg</span>}
          </div>
        </div>
      )}

      {/* Error */}
      {a.error && (
        <div className="p-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{a.error}</p>
        </div>
      )}

      {/* Stories */}
      {blocks.length > 0 && (
        <div className="p-3 space-y-2 max-h-96 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {blocks.map((block, i) => {
            const content = block.storyLine.replace(/^(\d+[\.\)])\s/, '');
            const asMatch = content.match(/^As a (.+?),?\s*I want (.+?),?\s*so that (.+?)\.?$/i);
            return (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700 text-sm">
                <div className="flex items-start gap-2">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${meta.bg} ${meta.color}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    {asMatch ? (
                      <p className="leading-relaxed text-gray-800 dark:text-gray-200">
                        <span className={`font-semibold ${meta.color}`}>As a {asMatch[1]}</span>
                        <span className="text-gray-500">, </span>
                        <span>I want {asMatch[2]}</span>
                        <span className="text-gray-500"> so that </span>
                        <span className="text-gray-600 dark:text-gray-400">{asMatch[3]}</span>
                      </p>
                    ) : (
                      <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{content}</p>
                    )}
                    {block.details.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-0.5">
                        {block.details.map((d, di) => (
                          <p key={di} className="text-xs text-gray-500 dark:text-gray-400">{d}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
