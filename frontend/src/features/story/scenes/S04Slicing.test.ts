import { buildSlicing } from "./S04Slicing";

it("measures the window's travel on refresh, not once (review #14)", () => {
  const calls: Record<string, unknown>[] = [];
  const tl = { to: (_t: unknown, vars: Record<string, unknown>) => { calls.push(vars); return tl; } };
  const root = document.createElement("section");
  root.innerHTML = '<div style="width:500px"><div data-window style="width:100px"></div></div><div data-window-ghost></div>';
  buildSlicing(tl as never, root);
  const slide = calls.find((v) => "x" in v);
  expect(typeof slide?.x).toBe("function");
});
