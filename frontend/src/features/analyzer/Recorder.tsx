import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Mic } from "../../components/icons";
import { useAnalyzer } from "./analyzerStore";
import { recordingFileName } from "./recording";

const MIC_BLOCKED = "Microphone access was blocked. You can still upload a file or use a demo recording.";

/** Record from the microphone (up to 60 s) and analyse the result. */
export function Recorder() {
  const { start, setMicError } = useAnalyzer();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const discard = useRef(false);

  // leaving mid-recording: release the microphone and submit nothing
  useEffect(() => () => {
    discard.current = true;
    recorder.current?.stop();
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (recording && seconds >= 60) recorder.current?.stop();
  }, [recording, seconds]);

  const begin = async () => {
    const cannotRecord = "This browser cannot record audio here. You can still upload a file or use a demo recording.";
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError(cannotRecord);
      return;
    }
    try {
      // ask for the microphone first: a denial is the likeliest problem and the most useful message
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (typeof MediaRecorder === "undefined") {
        stream.getTracks().forEach((t) => t.stop());
        setMicError(cannotRecord);
        return;
      }
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        recorder.current = null;
        if (discard.current) return;
        setRecording(false);
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        const name = recordingFileName(blob.type);
        void start(new File([blob], name, { type: blob.type }), name);
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      setRecording(true);
    } catch (error) {
      const name = (error as { name?: string }).name;
      setMicError(name === "NotAllowedError" || name === "SecurityError" ? MIC_BLOCKED : "No microphone was found. You can still upload a file or use a demo recording.");
    }
  };

  return recording ? (
    <Button variant="secondary" onClick={() => recorder.current?.stop()}>
      <span className="size-2 animate-pulse rounded-full bg-warn" /> Stop recording · <span className="tabular">{seconds}s</span>
    </Button>
  ) : (
    <Button variant="secondary" onClick={begin}><Mic /> Record</Button>
  );
}
