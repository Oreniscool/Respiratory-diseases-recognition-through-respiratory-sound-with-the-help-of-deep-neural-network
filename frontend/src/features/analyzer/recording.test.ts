import { recordingFileName } from "./recording";

it("names a recording after the container the browser actually produced (review #2)", () => {
  expect(recordingFileName("audio/webm;codecs=opus")).toBe("recording.webm");
  expect(recordingFileName("audio/ogg;codecs=opus")).toBe("recording.ogg");
  expect(recordingFileName("audio/mp4")).toBe("recording.m4a");
  expect(recordingFileName("audio/x-m4a")).toBe("recording.m4a");
  expect(recordingFileName("")).toBe("recording.webm");
});
