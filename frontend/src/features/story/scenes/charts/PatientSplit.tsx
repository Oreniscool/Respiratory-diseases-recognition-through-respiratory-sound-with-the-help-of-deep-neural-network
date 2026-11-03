import { useState } from "react";

const PATIENTS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const PER_PATIENT = 3;
/** A fixed "random" 75/25 assignment of the 24 recordings, so the illustration is the same every time. */
const RANDOM_TEST = new Set([2, 4, 9, 13, 17, 22]);
/** Patient split: whole patients G and H go to test (6 of 24 recordings, the same 75/25 share). */
const PATIENT_TEST = new Set(["G", "H"]);

type Mode = "random" | "patient";
type Recording = { patient: string; n: number; index: number };

const RECORDINGS: Recording[] = PATIENTS.flatMap((patient, p) =>
  Array.from({ length: PER_PATIENT }, (_, n) => ({ patient, n: n + 1, index: p * PER_PATIENT + n })),
);

export function splitOf(mode: Mode) {
  const inTest = (r: Recording) => (mode === "random" ? RANDOM_TEST.has(r.index) : PATIENT_TEST.has(r.patient));
  const train = RECORDINGS.filter((r) => !inTest(r));
  const test = RECORDINGS.filter(inTest);
  const trainPatients = new Set(train.map((r) => r.patient));
  const leaked = new Set(test.map((r) => r.patient).filter((p) => trainPatients.has(p)));
  return { train, test, leaked };
}

function Tile({ r, leaked }: { r: Recording; leaked: boolean }) {
  return (
    <li data-tile className={`flex size-11 flex-col items-center justify-center rounded-lg border-2 bg-paper text-ink ${leaked ? "border-warn" : "border-line"}`}
        title={`Patient ${r.patient}, recording ${r.n}${leaked ? " (this patient is also in the other set)" : ""}`}>
      <span className="text-base font-semibold leading-none">{r.patient}</span>
      <span className="tabular text-[0.65rem] leading-none text-ink-muted">#{r.n}</span>
    </li>
  );
}

/** Illustration: 8 patients with 3 recordings each, split at random or by patient; shared patients are outlined. */
export function PatientSplit() {
  const [mode, setMode] = useState<Mode>("random");
  const { train, test, leaked } = splitOf(mode);
  return (
    <div className="space-y-4 rounded-xl border border-line bg-paper-raised p-5">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How to split">
        {([["random", "Split recordings at random"], ["patient", "Split by patient"]] as const).map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={mode === id} onClick={() => setMode(id)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${mode === id ? "border-accent bg-accent text-paper" : "border-line bg-paper text-ink hover:border-ink"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-[3fr_1fr]">
        {([["Training", train], ["Test", test]] as const).map(([name, list]) => (
          <section key={name} aria-label={`${name} set`} className="rounded-lg border border-line p-3">
            <p className="m-0 mb-2 text-sm font-semibold text-ink">{name} <span className="tabular font-normal text-ink-muted">· {list.length} recordings</span></p>
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {list.map((r) => <Tile key={r.index} r={r} leaked={leaked.has(r.patient)} />)}
            </ul>
          </section>
        ))}
      </div>
      <p data-split-result aria-live="polite" className="m-0 text-sm text-ink">
        {leaked.size === 0
          ? "No patient appears on both sides: the test asks about people the model has never heard."
          : `${leaked.size} of ${PATIENTS.length} patients have recordings on both sides (outlined): the test partly checks whether the model remembers a patient it has already heard.`}
      </p>
    </div>
  );
}
