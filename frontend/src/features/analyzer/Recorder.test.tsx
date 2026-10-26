import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

const start = vi.fn();
vi.mock("./analyzerStore", () => ({ useAnalyzer: () => ({ start, setMicError: vi.fn() }) }));
const { Recorder } = await import("./Recorder");

it("leaving mid-recording turns the microphone off and submits nothing (review #3)", async () => {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => stream) } });
  class FakeRecorder {
    mimeType = "audio/webm";
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    start() {}
    stop() { this.onstop?.(); }
  }
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  const view = render(<Recorder />);
  await userEvent.click(screen.getByRole("button", { name: /record/i }));
  expect(await screen.findByText(/Stop recording/)).toBeInTheDocument();
  act(() => view.unmount());
  expect(track.stop).toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
