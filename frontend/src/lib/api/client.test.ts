import { afterEach, beforeEach, vi } from "vitest";
import { ApiError, OfflineError, TimeoutError, getHealth, predict, setMockMode } from "./client";
import { SAMPLE } from "../../content/facts";

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
const file = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" });

beforeEach(() => setMockMode(false));
afterEach(() => vi.unstubAllGlobals());

it("a 400 rejects with the server's message and status", async () => {
  vi.stubGlobal("fetch", vi.fn(() => json(400, { error: "Unsupported file" })));
  const err = await predict(file, "x.wav").catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err.message).toBe("Unsupported file");
  expect(err.status).toBe(400);
});

it("a 503 means the model is offline", async () => {
  vi.stubGlobal("fetch", vi.fn(() => json(503, { error: "unverified" })));
  await expect(predict(file, "x.wav")).rejects.toBeInstanceOf(OfflineError);
});

it("a network failure means offline", async () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
  await expect(predict(file, "x.wav")).rejects.toBeInstanceOf(OfflineError);
});

it("a timeout abort becomes TimeoutError", async () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new DOMException("timed out", "TimeoutError"))));
  await expect(predict(file, "x.wav")).rejects.toBeInstanceOf(TimeoutError);
});

it("an unverified model contract counts as offline", async () => {
  vi.stubGlobal("fetch", vi.fn(() => json(200, { ready: true, model_contract: "unverified", classes: [] })));
  await expect(getHealth()).rejects.toBeInstanceOf(OfflineError);
});

it("mock mode refuses a visitor's own recording instead of answering with the sample (review #1)", async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  setMockMode(true);
  const err = await predict(file, "x.wav").catch((e) => e);
  expect(err).toBeInstanceOf(OfflineError);
  expect(err.message).toMatch(/need the live model/i);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(SAMPLE.prediction).toBe("copd"); // the sample still exists for demo clips
});

it("predict posts the file and denoise=0 as multipart form data", async () => {
  const fetchSpy = vi.fn((_url: string, _init: RequestInit) => json(200, SAMPLE));
  vi.stubGlobal("fetch", fetchSpy);
  await predict(file, "rec.wav");
  const [url, init] = fetchSpy.mock.calls[0]!;
  expect(url).toMatch(/\/predict$/);
  const body = init.body as FormData;
  expect(body.get("file")).toBeInstanceOf(Blob);
  expect((body.get("file") as File).name).toBe("rec.wav");
  expect(body.get("denoise")).toBe("0");
});

it("a proxy in front of a stopped backend (502/504) also means offline", async () => {
  for (const status of [502, 504]) {
    vi.stubGlobal("fetch", vi.fn(() => json(status, {})));
    await expect(predict(file, "x.wav")).rejects.toBeInstanceOf(OfflineError);
  }
});

it("any failed health check counts as offline", async () => {
  vi.stubGlobal("fetch", vi.fn(() => json(500, { error: "boom" })));
  await expect(getHealth()).rejects.toBeInstanceOf(OfflineError);
});
