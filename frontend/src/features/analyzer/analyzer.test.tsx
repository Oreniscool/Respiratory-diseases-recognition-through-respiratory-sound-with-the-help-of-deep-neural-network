import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, vi } from "vitest";
import { SAMPLE } from "../../content/facts";

const client = vi.hoisted(() => ({ predict: vi.fn(), getHealth: vi.fn(), explain: vi.fn(), setMockMode: vi.fn() }));
vi.mock("../../lib/api/client", async (original) => {
  const actual = await original<typeof import("../../lib/api/client")>();
  return { ...actual, ...client, isMockMode: () => false };
});
vi.mock("../../lib/api/mock", () => ({ mockPredict: vi.fn(async () => SAMPLE), registerRecorded: vi.fn() }));

const { Analyzer } = await import("./Analyzer");
const { ApiError, OfflineError } = await import("../../lib/api/client");
const { useAnalyzer } = await import("./analyzerStore");

const wav = () => new File([new Uint8Array([82, 73, 70, 70])], "breath.wav", { type: "audio/wav" });

beforeEach(() => {
  vi.clearAllMocks();
  client.getHealth.mockResolvedValue({ ready: true, model_contract: "verified-metadata", classes: [] });
  act(() => useAnalyzer.getState().reset());
});

it("rejects an unsupported file before calling the model", async () => {
  render(<Analyzer />);
  const input = screen.getByLabelText(/upload a recording/i);
  await userEvent.upload(input, new File(["x"], "notes.txt", { type: "text/plain" }), { applyAccept: false });
  expect(await screen.findByText(/\.wav, \.flac, \.ogg, \.mp3, \.webm or \.m4a/)).toBeInTheDocument();
  expect(client.predict).not.toHaveBeenCalled();
});

it("says the model is offline before any upload when /health fails", async () => {
  client.getHealth.mockRejectedValue(new OfflineError());
  render(<Analyzer />);
  expect(await screen.findByText("The model is offline")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /use demo mode/i })).toBeInTheDocument();
});

it("offers demo mode when the model goes offline during an upload, and demo mode answers", async () => {
  client.predict.mockRejectedValue(new OfflineError());
  render(<Analyzer />);
  await userEvent.upload(screen.getByLabelText(/upload a recording/i), wav());
  expect(await screen.findByText("The model is offline")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /use demo mode/i }));
  expect(client.setMockMode).toHaveBeenCalledWith(true);
  expect(await screen.findByText("Strongest match")).toBeInTheDocument();
});

it("shows the server's own message when it rejects a file", async () => {
  client.predict.mockRejectedValue(new ApiError("Not a lung sound", 422));
  render(<Analyzer />);
  await userEvent.upload(screen.getByLabelText(/upload a recording/i), wav());
  expect(await screen.findByText(/Not a lung sound/)).toBeInTheDocument();
});

it("shows the story report after a successful analysis", async () => {
  client.predict.mockResolvedValue(SAMPLE);
  render(<Analyzer />);
  await userEvent.upload(screen.getByLabelText(/upload a recording/i), wav());
  expect(await screen.findByText("Strongest match")).toBeInTheDocument();
  await waitFor(() => expect(client.predict).toHaveBeenCalledWith(expect.any(File), "breath.wav", undefined));
});

it("keeps upload and demo available when the microphone is blocked", async () => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" })) },
  });
  render(<Analyzer />);
  await userEvent.click(screen.getByRole("button", { name: /record/i }));
  expect(await screen.findByText(/microphone access was blocked/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/upload a recording/i)).toBeEnabled();
});
