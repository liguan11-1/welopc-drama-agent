import fs from "node:fs";
import path from "node:path";

export function parseDotEnv(text) {
  const values = {};
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function loadLocalEnv({ cwd = process.cwd(), env = process.env } = {}) {
  const loadedFiles = [];
  const fileValues = {};

  for (const name of [".env", ".env.local"]) {
    const file = path.join(cwd, name);
    if (!fs.existsSync(file)) continue;
    Object.assign(fileValues, parseDotEnv(fs.readFileSync(file, "utf8")));
    loadedFiles.push(file);
  }

  return {
    env: { ...fileValues, ...env },
    loaded_files: loadedFiles,
  };
}
