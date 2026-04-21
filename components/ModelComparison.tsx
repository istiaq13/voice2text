'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, X, BarChart2, Download, CheckCircle } from 'lucide-react';
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

const MODEL_META: Record<string, { label: string; provider: string; color: string; bg: string; border: string; chartColor: string }> = {
  gemini: { label: 'Gemini 2.5 Flash', provider: 'Google', color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-950',     border: 'border-blue-200 dark:border-blue-800',   chartColor: '#3b82f6' },
  groq:   { label: 'Llama 3.3 70B',    provider: 'Groq',   color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-200 dark:border-orange-800', chartColor: '#f97316' },
  llama:  { label: 'Llama 3.1 8B',     provider: 'Ollama', color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-50 dark:bg-green-950',   border: 'border-green-200 dark:border-green-800',  chartColor: '#22c55e' },
  qwen:   { label: 'Qwen 2.5 7B',      provider: 'Ollama', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950', border: 'border-purple-200 dark:border-purple-800', chartColor: '#a855f7' },
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
    const isDuplicate = fingerprints.some(f => fp.split('-').filter(w => f.includes(w)).length >= 2);
    if (!isDuplicate) uniqueOk++;
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

function OverallBadge({ value }: { value: number }) {
  const grad = value >= 80 ? 'from-green-500 to-emerald-600' : value >= 50 ? 'from-yellow-500 to-orange-500' : 'from-red-500 to-rose-600';
  return (
    <div className={`text-center px-3 py-2 rounded-lg bg-gradient-to-r ${grad} text-white`}>
      <div className="text-2xl font-bold">{value}%</div>
      <div className="text-xs opacity-90">Overall</div>
    </div>
  );
}

// Pulsing skeleton bar for loading state
function SkeletonBar({ width = 'w-full' }: { width?: string }) {
  return <div className={`${width} h-3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse`} />;
}

function ModelLoadingCard({ model, state, totalRuns }: { model: string; state: PerModelState; totalRuns: number }) {
  const meta = MODEL_META[model] ?? { label: model, provider: '', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', chartColor: '#6b7280' };
  const pct = totalRuns > 0 ? Math.round((state.completedRuns / totalRuns) * 100) : 0;

  return (
    <div className={`rounded-xl border overflow-hidden border-gray-200 dark:border-gray-700`}>
      {/* Header */}
      <div className={`p-4 ${meta.bg} ${meta.border} border-b`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${meta.color}`}>{meta.label}</span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{meta.provider}</span>
          </div>
          <Loader2 className={`w-4 h-4 animate-spin ${meta.color}`} />
        </div>
      </div>

      {/* Progress */}
      <div className="p-4 bg-white dark:bg-gray-900 space-y-3">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            {state.completedRuns === 0
              ? 'Starting...'
              : `Run ${state.completedRuns} of ${totalRuns} complete`}
          </span>
          <span>{pct}%</span>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${meta.chartColor ? '' : 'bg-blue-500'}`}
            style={{ width: `${pct}%`, backgroundColor: meta.chartColor }}
          />
        </div>
        {/* Skeleton metrics */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-1">
              <SkeletonBar />
              <SkeletonBar width="w-2/3" />
            </div>
          ))}
        </div>
        {/* Skeleton story lines */}
        <div className="space-y-2 pt-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-1">
              <SkeletonBar />
              <SkeletonBar width="w-4/5" />
            </div>
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
  const [runs, setRuns] = useState(1);
  const [modelStates, setModelStates] = useState<Record<string, PerModelState>>({});
  const [isRunning, setIsRunning] = useState(false);

  const modelsToRun = Object.entries(availableModels)
    .filter(([, available]) => available)
    .map(([model]) => model);

  async function runComparison() {
    setIsRunning(true);

    // Show all cards immediately as 'running'
    const initial: Record<string, PerModelState> = {};
    for (const m of modelsToRun) initial[m] = { status: 'running', completedRuns: 0, runs: [] };
    setModelStates(initial);

    // Run each model independently in parallel
    await Promise.all(modelsToRun.map(async (model) => {
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

        // Update this model's card after every run
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
  }

  useEffect(() => { runComparison(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doneModels = modelsToRun.filter(m => modelStates[m]?.status === 'done' || modelStates[m]?.status === 'error');
  const aggregated = doneModels.map(m => toAggregated(m, modelStates[m], runs));
  const completedOk = aggregated.filter(a => !a.error);

  const winner = completedOk.length
    ? completedOk.reduce<AggregatedResult | null>((best, a) =>
        !best || a.avgMetrics.overallScore > best.avgMetrics.overallScore ? a : best, null)
    : null;

  const gridCols =
    modelsToRun.length === 1 ? 'grid-cols-1' :
    modelsToRun.length === 2 ? 'md:grid-cols-2' :
    modelsToRun.length === 3 ? 'md:grid-cols-3' :
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
              Same prompt · {modelsToRun.length} models · running in parallel
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Runs per model:</label>
            <Select value={String(runs)} onValueChange={v => setRuns(Number(v))} disabled={isRunning}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1×</SelectItem>
                <SelectItem value="3">3×</SelectItem>
                <SelectItem value="5">5×</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={runComparison} disabled={isRunning} size="sm" variant="outline">
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Re-run'}
          </Button>
          {completedOk.length > 0 && (
            <Button onClick={() => exportCSV(aggregated.filter(a => !a.error), runs)} size="sm" variant="outline">
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose} disabled={isRunning}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Live status bar — shows while running */}
      {isRunning && (
        <div className="flex flex-wrap gap-2">
          {modelsToRun.map(m => {
            const s = modelStates[m];
            const meta = MODEL_META[m];
            const isDone = s?.status === 'done' || s?.status === 'error';
            return (
              <div
                key={m}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                  isDone
                    ? `${meta?.bg} ${meta?.border} ${meta?.color}`
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'
                }`}
              >
                {isDone
                  ? <CheckCircle className="w-3 h-3" />
                  : <Loader2 className="w-3 h-3 animate-spin" />}
                {meta?.label}
                {runs > 1 && s && (
                  <span className="opacity-60">{s.completedRuns}/{runs}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Multi-run note */}
      {runs > 1 && !isRunning && doneModels.length > 0 && (
        <div className="text-xs px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
          {runs} runs per model — scores averaged for statistical reliability. Stories shown are from the best-scoring run.
        </div>
      )}

      {/* Model cards grid — always visible once comparison starts */}
      {modelsToRun.length > 0 && Object.keys(modelStates).length > 0 && (
        <div className={`grid gap-4 ${gridCols}`}>
          {modelsToRun.map(model => {
            const state = modelStates[model];
            if (!state) return null;

            // Still running — show loading card
            if (state.status === 'running') {
              return <ModelLoadingCard key={model} model={model} state={state} totalRuns={runs} />;
            }

            // Done — show result card
            const a = toAggregated(model, state, runs);
            const meta = MODEL_META[model] ?? { label: model, provider: '', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', chartColor: '#6b7280' };
            const blocks = a.bestStories ? parseBlocks(a.bestStories) : [];
            const isWinner = winner?.model === model;

            return (
              <div key={model} className={`rounded-xl border overflow-hidden transition-all ${isWinner ? 'border-gray-900 dark:border-gray-300' : 'border-gray-200 dark:border-gray-700'}`}>
                {/* Column header */}
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
                    </div>
                    <div className="mt-2 text-center text-xs text-gray-400">
                      {a.avgMetrics.avgWordCount} words/story avg
                      {runs > 1 && <span className="ml-2">· {runs}-run average</span>}
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

                {/* Best stories */}
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
          })}
        </div>
      )}

      {/* Charts — appear once at least 2 models are done */}
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
                      fillOpacity={0.15} strokeWidth={2}
                    />
                  ))}
                  <Legend />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}

      {/* Summary scorecard — appears once all models are done */}
      {!isRunning && aggregated.length > 0 && (
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
      {!isRunning && aggregated.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-500 dark:text-gray-400 pt-1">
          <div><span className="font-medium text-gray-700 dark:text-gray-300">Format</span> — "As a X, I want Y so that Z" compliance</div>
          <div><span className="font-medium text-gray-700 dark:text-gray-300">Roles</span> — specific roles used (not generic "user")</div>
          <div><span className="font-medium text-gray-700 dark:text-gray-300">AC</span> — stories with Given/When/Then criteria</div>
          <div><span className="font-medium text-gray-700 dark:text-gray-300">Unique</span> — stories covering distinct features</div>
        </div>
      )}
    </Card>
  );
}
