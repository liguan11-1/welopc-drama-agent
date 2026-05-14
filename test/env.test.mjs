import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadLocalEnv, parseDotEnv } from "../src/env.mjs";

test("parseDotEnv reads simple key value pairs without comments", () => {
  const parsed = parseDotEnv(`
# comment
ARK_API_KEY=local-secret
VIDEO_RATIO="9:16"
VIDEO_GENERATE_AUDIO=false
`);

  assert.equal(parsed.ARK_API_KEY, "local-secret");
  assert.equal(parsed.VIDEO_RATIO, "9:16");
  assert.equal(parsed.VIDEO_GENERATE_AUDIO, "false");
});

test("loadLocalEnv merges .env and .env.local while shell env wins", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "welopc-env-"));
  fs.writeFileSync(path.join(cwd, ".env"), "ARK_API_KEY=base-key\nVIDEO_RESOLUTION=720p\n", "utf8");
  fs.writeFileSync(path.join(cwd, ".env.local"), "ARK_API_KEY=local-key\nVIDEO_RATIO=9:16\n", "utf8");

  const result = loadLocalEnv({
    cwd,
    env: { ARK_API_KEY: "shell-key" },
  });

  assert.deepEqual(result.loaded_files.map((file) => path.basename(file)), [".env", ".env.local"]);
  assert.equal(result.env.ARK_API_KEY, "shell-key");
  assert.equal(result.env.VIDEO_RESOLUTION, "720p");
  assert.equal(result.env.VIDEO_RATIO, "9:16");
});
