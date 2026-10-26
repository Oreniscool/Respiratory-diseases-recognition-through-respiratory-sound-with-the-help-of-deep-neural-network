export const ANALYSIS_RATE = 22050;

/** Decode any browser-supported audio file to mono at 22,050 Hz (decodeAudioData resamples to the context rate). */
export async function decodeTo22050(file: Blob): Promise<Float32Array> {
  const context = new OfflineAudioContext(1, 1, ANALYSIS_RATE);
  const audio = await context.decodeAudioData(await file.arrayBuffer());
  if (audio.numberOfChannels === 1) return audio.getChannelData(0).slice();
  const mono = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const channel = audio.getChannelData(c);
    for (let i = 0; i < mono.length; i++) mono[i]! += channel[i]! / audio.numberOfChannels;
  }
  return mono;
}
