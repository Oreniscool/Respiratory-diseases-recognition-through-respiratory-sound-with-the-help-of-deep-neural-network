import { create } from "zustand";
import { ApiError, OfflineError, TimeoutError, predict, setMockMode } from "../../lib/api/client";
import { mockPredict } from "../../lib/api/mock";
import type { PredictResult } from "../../lib/api/types";
import { DEMO_CLIPS } from "../../content/demoClips";

export const ACCEPTED = [".wav", ".flac", ".ogg", ".mp3", ".webm", ".m4a"] as const;
export const FORMATS_MESSAGE = "Use a .wav, .flac, .ogg, .mp3, .webm or .m4a file.";

type ErrorKind = "offline" | "rejected" | "timeout" | "mic";

type AnalyzerState = {
  phase: "pick" | "running" | "done" | "error";
  file?: Blob;
  name?: string;
  demoId?: string;
  result?: PredictResult;
  error?: { kind: ErrorKind; message: string };
  /** the backend is unreachable or has no verified model: demo clips answer from recorded responses */
  offline: boolean;
  start: (file: Blob, name: string, demoId?: string) => Promise<void>;
  startDemo: (id: string) => Promise<void>;
  enterDemoMode: () => Promise<void>;
  setOffline: (offline: boolean) => void;
  setMicError: (message: string) => void;
  reset: () => void;
};

const hasAcceptedExtension = (name: string) => ACCEPTED.some((ext) => name.toLowerCase().endsWith(ext));

function describe(error: unknown): { kind: ErrorKind; message: string } {
  if (error instanceof OfflineError) return { kind: "offline", message: "The model is offline" };
  if (error instanceof TimeoutError) return { kind: "timeout", message: "The model took too long to answer." };
  if (error instanceof ApiError) return { kind: "rejected", message: error.message };
  return { kind: "rejected", message: error instanceof Error ? error.message : String(error) };
}

export const useAnalyzer = create<AnalyzerState>((set, get) => ({
  phase: "pick",
  offline: false,
  start: async (file, name, demoId) => {
    if (!demoId && !hasAcceptedExtension(name)) {
      set({ phase: "error", error: { kind: "rejected", message: `That file type is not supported. ${FORMATS_MESSAGE}` } });
      return;
    }
    set({ phase: "running", file, name, demoId, result: undefined, error: undefined });
    try {
      const result = demoId && get().offline ? await mockPredict(demoId) : await predict(file, name, demoId);
      if (get().file === file) set({ phase: "done", result });
    } catch (error) {
      if (get().file !== file) return;
      const described = describe(error);
      set({ phase: "error", error: described, offline: described.kind === "offline" || get().offline });
    }
  },
  startDemo: async (id) => {
    const clip = DEMO_CLIPS.find((c) => c.id === id) ?? DEMO_CLIPS[0]!;
    const blob = clip.file ? await fetch(clip.file).then((r) => r.blob()).catch(() => new Blob()) : new Blob();
    await get().start(blob, `${clip.id}.mp3`, clip.id);
  },
  enterDemoMode: async () => {
    setMockMode(true);
    set({ offline: true });
    await get().startDemo(DEMO_CLIPS[0]!.id);
  },
  setOffline: (offline) => set({ offline }),
  setMicError: (message) => set({ phase: "error", error: { kind: "mic", message } }),
  reset: () => set({ phase: "pick", file: undefined, name: undefined, demoId: undefined, result: undefined, error: undefined }),
}));
