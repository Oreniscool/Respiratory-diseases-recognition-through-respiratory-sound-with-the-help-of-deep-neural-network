/** librosa frame count for a centred STFT. */
export function frameCount(nSamples: number, hop = 512): number {
  return 1 + Math.floor(nSamples / hop);
}

/** Window starts as preprocessing.window_feature_sequence: every `hop`, plus one anchored at the end. */
export function windowStarts(totalFrames: number, maxLen = 200, hop = 100): number[] {
  if (totalFrames <= maxLen) return [0];
  const starts: number[] = [];
  for (let s = 0; s <= totalFrames - maxLen; s += hop) starts.push(s);
  const final = totalFrames - maxLen;
  if (starts.at(-1) !== final) starts.push(final);
  return starts;
}
