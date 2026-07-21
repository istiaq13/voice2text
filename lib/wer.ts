// Word Error Rate — the standard transcription-accuracy metric for RQ1
// (does audio condition/transcription error propagate into story quality?).
// WER = (substitutions + deletions + insertions) / reference word count,
// computed via word-level edit distance (not character-level), since that's
// the accepted convention for ASR evaluation.

export interface WERResult {
  wer: number; // can exceed 1 if the hypothesis has many extra words
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceWordCount: number;
  hypothesisWordCount: number;
}

function normalize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+/g) || []);
}

// Standard DP edit-distance over word sequences, then backtrack once to
// classify each edit as a substitution, deletion, or insertion (not just the
// total count) — useful for the paper to discuss error *types*, not only rate.
export function computeWER(reference: string, hypothesis: string): WERResult {
  const ref = normalize(reference);
  const hyp = normalize(hypothesis);
  const n = ref.length;
  const m = hyp.length;

  if (n === 0) {
    return { wer: m === 0 ? 0 : Infinity, substitutions: 0, deletions: 0, insertions: m, referenceWordCount: 0, hypothesisWordCount: m };
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (ref[i - 1] === hyp[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j - 1], // substitution
          dp[i - 1][j],     // deletion (word in ref, missing from hyp)
          dp[i][j - 1]      // insertion (extra word in hyp)
        );
      }
    }
  }

  // Backtrack from (n, m) to count operation types along one optimal path.
  let substitutions = 0, deletions = 0, insertions = 0;
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ref[i - 1] === hyp[j - 1]) {
      i--; j--;
      continue;
    }
    const sub = i > 0 && j > 0 ? dp[i - 1][j - 1] : Infinity;
    const del = i > 0 ? dp[i - 1][j] : Infinity;
    const ins = j > 0 ? dp[i][j - 1] : Infinity;
    const best = Math.min(sub, del, ins);

    if (best === sub) {
      substitutions++;
      i--; j--;
    } else if (best === del) {
      deletions++;
      i--;
    } else {
      insertions++;
      j--;
    }
  }

  return {
    wer: (substitutions + deletions + insertions) / n,
    substitutions,
    deletions,
    insertions,
    referenceWordCount: n,
    hypothesisWordCount: m,
  };
}
