import { parseCsv } from "./csv";

it("parses quoted fields with commas, quotes and newlines", () => {
  const rows = parseCsv('id,json,note\nA,"{""a"": 1, ""b"": 2}","two\nlines"\nB,plain,\n');
  expect(rows).toEqual([
    { id: "A", json: '{"a": 1, "b": 2}', note: "two\nlines" },
    { id: "B", json: "plain", note: "" },
  ]);
});
