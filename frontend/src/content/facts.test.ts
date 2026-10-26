import { FACTS, SAMPLE, WHY } from "./facts";

it("every fact and reason names its source", () => {
  for (const [key, fact] of Object.entries(FACTS)) expect(fact.source, key).not.toBe("");
  for (const [key, why] of Object.entries(WHY)) expect(why.source, key).not.toBe("");
});

it("the sample response is the recorded COPD recording", () => {
  expect(SAMPLE.prediction).toBe("copd");
  expect(SAMPLE.confidence).toBe(87);
  expect(SAMPLE.members?.length).toBe(4);
});

it("formats the headline accuracy as on the slide", () => {
  expect(FACTS.patientAccuracy.display).toBe("75.5%");
  expect(FACTS.ciLow.display).toBe("63.3%");
  expect(FACTS.ciHigh.display).toBe("87.8%");
});

it("reasons never use diagnostic language", () => {
  for (const why of Object.values(WHY)) expect(why.text).not.toMatch(/diagnos/i);
});

it("reliability bins and per-class recall come from the test metrics", () => {
  expect(FACTS.reliabilityBins.value).toHaveLength(6);
  expect(FACTS.perClassRecallPatient.value).toMatchObject({ asthma: { recall: 1, patients: 8 } });
});
