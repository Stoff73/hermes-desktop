// @lat: [[chat-commands#Slash command execution#Completion text reconciliation]]

/**
 * Detect whether `partial` looks like a chunk-dropped copy of `full`.
 *
 * A stream assembled with dropped delta chunks is a concatenation of
 * **contiguous substrings** of the canonical text, in order — e.g.
 * "! What are we working on?" for "Hey! What are we working on today?", or
 * "Sat planet from the Sun" for "Saturn is the sixth planet from the Sun".
 *
 * A plain character-subsequence test is too loose: unrelated English
 * sentences often embed as scattered 1–2 character fragments, which would
 * make a genuine pre-tool-call segment (or a distinct short reasoning
 * segment) look like a damaged copy and get erased. So the match is greedy
 * over runs: every matched segment must be at least `minRun` characters
 * (the last segment may be shorter — a trailing "?" survives chunking), with
 * arbitrary gaps between runs. On top of the shape test, callers get
 * coverage guards: the partial must be non-trivial (≥ `minLength`) and cover
 * a substantial share of the full text (≥ `minCoverage`), so a tiny
 * fragment can never cancel a long canonical text.
 *
 * Inputs are expected to be whitespace-normalized by the caller.
 */
export function isLossyChunkCopy(
  partial: string,
  full: string,
  {
    minRun = 3,
    minLength = 12,
    minCoverage = 0.3,
  }: { minRun?: number; minLength?: number; minCoverage?: number } = {},
): boolean {
  if (!partial || !full) return false;
  if (partial.length < minLength) return false;
  if (partial.length >= full.length) return false;
  if (partial.length < minCoverage * full.length) return false;

  let i = 0; // position in partial
  let j = 0; // position in full
  while (i < partial.length) {
    const remaining = partial.length - i;
    const probeLen = Math.min(minRun, remaining);
    const probe = partial.slice(i, i + probeLen);
    const at = full.indexOf(probe, j);
    if (at < 0) return false;
    // A short trailing probe (the final run) may be under minRun; any other
    // run must anchor with at least minRun matching characters.
    if (probeLen < minRun && remaining > probeLen) return false;
    // Extend the run as far as the two texts agree.
    let len = probeLen;
    while (
      i + len < partial.length &&
      at + len < full.length &&
      partial[i + len] === full[at + len]
    ) {
      len++;
    }
    i += len;
    j = at + len;
  }
  return true;
}

/**
 * A chunk-dropped fragment too short for `isLossyChunkCopy`'s floors can still
 * be recognised by its seams: where two runs of `full` were glued together in
 * `partial` with word characters on both sides ("in" + "2**?" → "in2**?"),
 * something between them was dropped. Genuine text never splices mid-word, so
 * a single such seam is decisive where length and coverage are not.
 *
 * Same greedy in-order run walk as `isLossyChunkCopy`; `minRun` is 2 because
 * the dropped deltas are single tokens and the surviving runs are tiny.
 */
export function hasDroppedWordSeam(
  partial: string,
  full: string,
  minRun = 2,
): boolean {
  if (!partial || !full || partial.length >= full.length) return false;
  const word = /\w/;
  let i = 0;
  let j = 0;
  let prevEnd = -1;
  while (i < partial.length) {
    const remaining = partial.length - i;
    const probeLen = Math.min(minRun, remaining);
    const at = full.indexOf(partial.slice(i, i + probeLen), j);
    if (at < 0) return false;
    if (probeLen < minRun && remaining > probeLen) return false;
    if (
      prevEnd >= 0 &&
      at > prevEnd &&
      word.test(partial[i - 1]) &&
      word.test(partial[i])
    ) {
      return true;
    }
    let len = probeLen;
    while (
      i + len < partial.length &&
      at + len < full.length &&
      partial[i + len] === full[at + len]
    ) {
      len++;
    }
    i += len;
    j = prevEnd = at + len;
  }
  return false;
}
