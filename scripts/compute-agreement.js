#!/usr/bin/env node
// Cohen's kappa for two independent raters' completed annotation files
// (blueprint §7/§8: "we measure our own agreement too"). Matches rows by
// storyId (for the 8 individual QUS criteria + faithful + traceability) and
// by batchId (for the 5 set-level QUS criteria), and reports kappa,
// observed/expected agreement, and how many pairs were actually usable.
//
// Usage:
//   node scripts/compute-agreement.js <rater-A-stories.csv> <rater-B-stories.csv> [<rater-A-batches.csv> <rater-B-batches.csv>]
//
// Cells must contain exactly "Pass"/"Fail" (the 13 QUS criteria) or
// "Yes"/"No" (faithful, traceabilityCorrect) — case-insensitive, nothing
// else. This is deliberate: silently guessing what a rater "meant" from
// free-form text risks misreading real research data, so an unrecognized or
// blank cell is reported and excluded rather than guessed.

const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');

const INDIVIDUAL_CRITERIA = ['wellFormed', 'atomic', 'minimal', 'conceptuallySound', 'problemOriented', 'unambiguous', 'fullSentence', 'estimatable'];
const STORY_JUDGMENT_COLUMNS = [...INDIVIDUAL_CRITERIA, 'faithful', 'traceabilityCorrect'];
const SET_LEVEL_CRITERIA = ['conflictFree', 'unique', 'uniform', 'independent', 'complete'];

const POSITIVE = new Set(['pass', 'yes']);
const NEGATIVE = new Set(['fail', 'no']);

function normalizeLabel(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (POSITIVE.has(v)) return 'pos';
  if (NEGATIVE.has(v)) return 'neg';
  return null; // blank or unrecognized — excluded, not guessed
}

// Standard Cohen's kappa for two raters over binary/nominal labels.
function cohensKappa(labelsA, labelsB) {
  const n = labelsA.length;
  if (n === 0) return null;

  const categories = new Set([...labelsA, ...labelsB]);
  let agree = 0;
  const countA = {}, countB = {};
  for (const c of categories) { countA[c] = 0; countB[c] = 0; }

  for (let i = 0; i < n; i++) {
    if (labelsA[i] === labelsB[i]) agree++;
    countA[labelsA[i]]++;
    countB[labelsB[i]]++;
  }

  const po = agree / n;
  let pe = 0;
  for (const c of categories) {
    pe += (countA[c] / n) * (countB[c] / n);
  }

  const kappa = pe === 1 ? (po === 1 ? 1 : 0) : (po - pe) / (1 - pe);
  return { kappa, po, pe, n };
}

// Landis & Koch (1977) — the standard interpretation scale used by both
// USeR and Inter2US when reporting their own kappa values.
function interpret(kappa) {
  if (kappa < 0) return 'poor';
  if (kappa <= 0.20) return 'slight';
  if (kappa <= 0.40) return 'fair';
  if (kappa <= 0.60) return 'moderate';
  if (kappa <= 0.80) return 'substantial';
  return 'almost perfect';
}

function reportAgreement(label, rowsA, rowsB, idKey, columns) {
  const byIdB = new Map(rowsB.map((r) => [r[idKey], r]));
  console.log(`\n=== ${label} (matched on ${idKey}) ===`);

  const results = [];
  for (const col of columns) {
    const pairsA = [], pairsB = [];
    let skipped = 0;
    for (const rowA of rowsA) {
      const rowB = byIdB.get(rowA[idKey]);
      if (!rowB) { skipped++; continue; }
      const a = normalizeLabel(rowA[col]);
      const b = normalizeLabel(rowB[col]);
      if (a === null || b === null) { skipped++; continue; }
      pairsA.push(a); pairsB.push(b);
    }

    const result = cohensKappa(pairsA, pairsB);
    if (!result) {
      console.log(`  ${col}: no usable pairs (${skipped} skipped — blank, unrecognized, or unmatched)`);
      results.push({ column: col, kappa: null });
      continue;
    }
    console.log(
      `  ${col}: kappa=${result.kappa.toFixed(3)} (${interpret(result.kappa)}), ` +
      `observed agreement=${(result.po * 100).toFixed(1)}%, n=${result.n}` +
      (skipped > 0 ? `, ${skipped} skipped` : '')
    );
    results.push({ column: col, kappa: result.kappa, n: result.n });
  }

  const usable = results.filter((r) => r.kappa !== null);
  if (usable.length > 0) {
    const avg = usable.reduce((sum, r) => sum + r.kappa, 0) / usable.length;
    console.log(`  --- average kappa across ${usable.length} criteria: ${avg.toFixed(3)} (${interpret(avg)}) ---`);
  }
  return results;
}

function main() {
  const [, , storiesAPath, storiesBPath, batchesAPath, batchesBPath] = process.argv;
  if (!storiesAPath || !storiesBPath) {
    console.error('Usage: node scripts/compute-agreement.js <rater-A-stories.csv> <rater-B-stories.csv> [<rater-A-batches.csv> <rater-B-batches.csv>]');
    process.exit(1);
  }

  const rowsA = parseCsv(fs.readFileSync(path.resolve(storiesAPath), 'utf-8'));
  const rowsB = parseCsv(fs.readFileSync(path.resolve(storiesBPath), 'utf-8'));
  reportAgreement('Per-story QUS criteria + faithfulness + traceability', rowsA, rowsB, 'storyId', STORY_JUDGMENT_COLUMNS);

  if (batchesAPath && batchesBPath) {
    const batchRowsA = parseCsv(fs.readFileSync(path.resolve(batchesAPath), 'utf-8'));
    const batchRowsB = parseCsv(fs.readFileSync(path.resolve(batchesBPath), 'utf-8'));
    reportAgreement('Set-level QUS criteria (per batch)', batchRowsA, batchRowsB, 'batchId', SET_LEVEL_CRITERIA);
  } else {
    console.log('\n(no batch-level files given — skipping the 5 set-level QUS criteria)');
  }
}

main();
