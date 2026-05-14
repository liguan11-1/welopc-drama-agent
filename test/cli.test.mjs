import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("CLI prints help", () => {
  const result = spawnSync(process.execPath, ["bin/welopc-drama-agent.js", "--help"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /welopc drama/);
  assert.match(result.stdout, /new --topic/);
});
