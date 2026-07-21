#!/usr/bin/env node
// Builds the ~100-story stratified human-annotation sample (blueprint §7)
// from a batch-runner results CSV. Produces two BLIND rater files (identical
// content, no model/mode/condition labels and no automated scores, so raters
// judge independently without anchoring on each other or on the machine's own
// verdict) plus a researcher-only key file for merging afterward.
//
// The 13 QUS criteria (Lucassen et al., "Improving Agile Requirements: The
// Quality User Story Framework and Tool", Requirements Engineering 21(3),
// 2016 — Table 1) split into two kinds:
//   - 8 apply to a single story: Well-formed, Atomic, Minimal, Conceptually
//     sound, Problem-oriented, Unambiguous, Full sentence, Estimatable.
//   - 5 apply to a SET of stories generated together: Conflict-free, Unique,
//     Uniform, Independent, Complete.
// So individual criteria are scored per story, and the 5 set-level ones are
// scored once per BATCH (one generation call's worth of stories), with the
// rater seeing the whole batch together — not pooled across the full
// experiment, since a batch (one recording x model x mode x run) is the
// natural "set" a real QUS reviewer would look at.
//
// Usage:
//   node scripts/sample-for-annotation.js <experiment-results.csv> [--target 100] [--out-dir ./annotation]

const fs = require('fs');
const path = require('path');
const { parseCsv, writeCsv } = require('./lib/csv');

const INDIVIDUAL_CRITERIA = [
  ['wellFormed', 'Well-formed — includes at least a role and a means'],
  ['atomic', 'Atomic — expresses exactly one feature'],
  ['minimal', 'Minimal — contains nothing more than role, means, and ends'],
  ['conceptuallySound', 'Conceptually sound — the means is a feature, the end is a rationale (not another feature)'],
  ['problemOriented', 'Problem-oriented — specifies the problem, not a prescribed solution'],
  ['unambiguous', 'Unambiguous — avoids terms/abstractions with multiple readings'],
  ['fullSentence', 'Full sentence — well-formed grammatically'],
  ['estimatable', 'Estimatable — not so coarse-grained it is hard to plan/prioritize'],
];

const SET_LEVEL_CRITERIA = [
  ['conflictFree', 'Conflict-free — no story in this batch contradicts another'],
  ['unique', 'Unique — no duplicate stories in this batch'],
  ['uniform', 'Uniform — every story in this batch follows the same template'],
  ['independent', 'Independent — no story in this batch depends on another'],
  ['complete', 'Complete — this batch, if implemented, leaves no obvious gap'],
];

function parseArgs() {
  const [, , csvPathArg, ...rest] = process.argv;
  if (!csvPathArg) {
    console.error('Usage: node scripts/sample-for-annotation.js <experiment-results.csv> [--target 100] [--out-dir ./annotation]');
    process.exit(1);
  }
  let target = 100;
  let outDir = './annotation';
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--target') target = parseInt(rest[++i], 10);
    if (rest[i] === '--out-dir') outDir = rest[++i];
  }
  return { csvPath: path.resolve(csvPathArg), target, outDir: path.resolve(outDir) };
}

// A tiny deterministic hash-based shuffle — reproducible (same input always
// gives the same sample) rather than Math.random(), since the sample
// composition should be reportable and re-derivable in the paper.
function stableShuffle(items, keyFn) {
  return items
    .map((item) => {
      const key = keyFn(item);
      let h = 0;
      for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
      return { item, h };
    })
    .sort((a, b) => a.h - b.h)
    .map((x) => x.item);
}

function main() {
  const { csvPath, target, outDir } = parseArgs();
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf-8'));
  if (rows.length === 0) {
    console.error('No rows found in', csvPath);
    process.exit(1);
  }

  // Group into batches: one generation call's worth of stories.
  const batches = new Map();
  for (const row of rows) {
    const batchKey = [row.recordingId, row.model, row.mode, row.run].join('::');
    if (!batches.has(batchKey)) batches.set(batchKey, []);
    batches.get(batchKey).push(row);
  }

  // Group batches by (model, mode) so the sample is stratified across them.
  const groups = new Map();
  for (const [batchKey, batchRows] of batches) {
    const groupKey = `${batchRows[0].model}::${batchRows[0].mode}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push({ batchKey, rows: batchRows });
  }
  for (const [groupKey, groupBatches] of groups) {
    groups.set(groupKey, stableShuffle(groupBatches, (b) => b.batchKey));
  }

  // Round-robin across groups, pulling one whole batch at a time, until the
  // target story count is reached (or every batch has been used).
  const groupKeys = stableShuffle([...groups.keys()], (k) => k);
  const groupCursors = Object.fromEntries(groupKeys.map((k) => [k, 0]));
  const selectedBatches = [];
  let storyCount = 0;
  let anyLeft = true;
  while (storyCount < target && anyLeft) {
    anyLeft = false;
    for (const groupKey of groupKeys) {
      if (storyCount >= target) break;
      const cursor = groupCursors[groupKey];
      const groupBatches = groups.get(groupKey);
      if (cursor >= groupBatches.length) continue;
      anyLeft = true;
      const batch = groupBatches[cursor];
      groupCursors[groupKey] = cursor + 1;
      selectedBatches.push(batch);
      storyCount += batch.rows.length;
    }
  }

  console.log(`Selected ${selectedBatches.length} batches (${storyCount} stories) from ${batches.size} available batches, target was ${target}.`);
  console.log('Group sizes used:', groupKeys.map((k) => `${k}: ${groupCursors[k]}/${groups.get(k).length} batches`).join(' | '));

  fs.mkdirSync(outDir, { recursive: true });

  const blindStoryHeader = [
    'storyId', 'batchId', 'storyText', 'segmentText',
    ...INDIVIDUAL_CRITERIA.map(([key]) => key),
    'faithful', 'traceabilityCorrect', 'notes',
  ];
  const blindBatchHeader = [
    'batchId', 'allStoriesInBatch',
    ...SET_LEVEL_CRITERIA.map(([key]) => key),
    'notes',
  ];
  const keyStoryHeader = [
    'storyId', 'batchId', 'recordingId', 'condition', 'domain', 'model', 'mode', 'run', 'storyIndex',
    'storyText', 'segmentText', 'segmentId', 'segmentStart', 'segmentEnd',
    'automatedFaithfulScore', 'automatedFaithful', 'automatedQualityScore', 'automatedVerified',
    'formatComplete', 'readable', 'easyLanguage', 'iterations',
  ];

  const blindStoryRowsA = [], blindStoryRowsB = [];
  const blindBatchRowsA = [], blindBatchRowsB = [];
  const keyRows = [];

  selectedBatches.forEach((batch, batchIdx) => {
    const batchId = `B${String(batchIdx + 1).padStart(3, '0')}`;
    const allStoriesText = batch.rows.map((r, i) => `${i + 1}. ${r.storyText.split('\n')[0]}`).join('\n');

    const blankBatchRow = { batchId, allStoriesInBatch: allStoriesText, notes: '' };
    SET_LEVEL_CRITERIA.forEach(([key]) => { blankBatchRow[key] = ''; });
    blindBatchRowsA.push({ ...blankBatchRow });
    blindBatchRowsB.push({ ...blankBatchRow });

    batch.rows.forEach((row, storyIdx) => {
      const storyId = `${batchId}-S${storyIdx}`;

      const blankStoryRow = { storyId, batchId, storyText: row.storyText, segmentText: row.segmentText, faithful: '', traceabilityCorrect: '', notes: '' };
      INDIVIDUAL_CRITERIA.forEach(([key]) => { blankStoryRow[key] = ''; });
      blindStoryRowsA.push({ ...blankStoryRow });
      blindStoryRowsB.push({ ...blankStoryRow });

      keyRows.push({
        storyId, batchId,
        recordingId: row.recordingId, condition: row.condition, domain: row.domain,
        model: row.model, mode: row.mode, run: row.run, storyIndex: row.storyIndex,
        storyText: row.storyText, segmentText: row.segmentText,
        segmentId: row.segmentId, segmentStart: row.segmentStart, segmentEnd: row.segmentEnd,
        automatedFaithfulScore: row.faithfulScore, automatedFaithful: row.faithful,
        automatedQualityScore: row.qualityScore, automatedVerified: row.verified,
        formatComplete: row.formatComplete, readable: row.readable, easyLanguage: row.easyLanguage,
        iterations: row.iterations,
      });
    });
  });

  writeCsv(path.join(outDir, 'annotation-rater-A-stories.csv'), blindStoryHeader, blindStoryRowsA);
  writeCsv(path.join(outDir, 'annotation-rater-B-stories.csv'), blindStoryHeader, blindStoryRowsB);
  writeCsv(path.join(outDir, 'annotation-rater-A-batches.csv'), blindBatchHeader, blindBatchRowsA);
  writeCsv(path.join(outDir, 'annotation-rater-B-batches.csv'), blindBatchHeader, blindBatchRowsB);
  writeCsv(path.join(outDir, 'annotation-key.csv'), keyStoryHeader, keyRows);

  console.log(`\nWrote to ${outDir}:`);
  console.log('  annotation-rater-A-stories.csv / annotation-rater-B-stories.csv — identical, blind, one row per story');
  console.log('  annotation-rater-A-batches.csv / annotation-rater-B-batches.csv — identical, blind, one row per batch (set-level criteria)');
  console.log('  annotation-key.csv — researcher-only: real model/mode/condition + automated scores, for merging after scoring');
  console.log('\nGive the two "-stories.csv" + "-batches.csv" pairs to two independent raters. Do not show them the key file.');
}

main();
