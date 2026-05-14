import fs from "node:fs";
import path from "node:path";
import { ensureDir, writeJson } from "./files.mjs";

export function importManualBgm({ projectDir, file }) {
  if (!file || !fs.existsSync(file)) {
    throw new Error("BGM file does not exist.");
  }
  const output = path.join(projectDir, "assets", "audio", "bgm.mp3");
  ensureDir(path.dirname(output));
  fs.copyFileSync(file, output);
  const state = {
    provider: "manual",
    source_path: path.resolve(file),
    output_path: output,
    imported_at: new Date().toISOString(),
  };
  writeJson(path.join(projectDir, "outputs", "audio", "bgm_state.json"), state);
  return state;
}
