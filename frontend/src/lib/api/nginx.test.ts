// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const block = (conf: string, location: string) => conf.slice(conf.indexOf(location), conf.indexOf("}", conf.indexOf(location)));

it("nginx waits at least as long as the client for /predict and /explain (review #13)", () => {
  for (const file of [resolve(here, "../../../nginx.conf"), resolve(here, "../../../../Dockerfile")]) {
    const conf = readFileSync(file, "utf8");
    for (const location of ["location /predict", "location = /explain"]) {
      const timeout = /proxy_read_timeout\s+(\d+)s/.exec(block(conf, location));
      expect(timeout, `${file}: ${location}`).not.toBeNull();
      expect(Number(timeout![1])).toBeGreaterThanOrEqual(125);
    }
  }
});
