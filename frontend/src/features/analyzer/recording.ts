/** The file name for a MediaRecorder blob, matching the container the browser actually produced. */
export function recordingFileName(mimeType: string): string {
  const type = mimeType.toLowerCase();
  if (type.includes("ogg")) return "recording.ogg"; // Firefox
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) return "recording.m4a"; // Safari
  return "recording.webm"; // Chromium
}
