let cached: boolean | undefined;

function detect(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Whether this browser can render the 3D scenes (checked once). */
export function useWebGL(): boolean {
  cached ??= typeof document !== "undefined" && detect();
  return cached;
}
