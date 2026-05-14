import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("CLI prints Chinese help", () => {
  const result = spawnSync(process.execPath, ["bin/welopc-drama-agent.js", "--help"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /welopc 短剧 agent/);
  assert.match(result.stdout, /WelOPC 别名/);
  assert.match(result.stdout, /new --topic/);
  assert.match(result.stdout, / images --project/);
  assert.match(result.stdout, / preflight --project/);
  assert.match(result.stdout, / sound --project/);
});
