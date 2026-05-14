import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "./files.mjs";

const PACKAGE_FILES = [
  "manifest.json",
  "story_bible.md",
  "characters.json",
  "scenes.json",
  "props.json",
  "shots.jsonl",
  "image_prompts.jsonl",
  "video_prompts.jsonl",
  "audio_plan.md",
  "audio_layer_design.md",
  "subtitle_timeline.jsonl",
  "render_queue.jsonl",
];

export function hashProductionPackage(projectDir) {
  const hash = crypto.createHash("sha256");
  for (const file of PACKAGE_FILES) {
    const fullPath = path.join(projectDir, file);
    if (fs.existsSync(fullPath)) {
      hash.update(file);
      hash.update(fs.readFileSync(fullPath));
    }
  }
  return hash.digest("hex");
}

export function approveProject(projectDir) {
  const approval = {
    approved: true,
    approved_at: new Date().toISOString(),
    package_hash: hashProductionPackage(projectDir),
  };
  writeJson(path.join(projectDir, "approval.json"), approval);
  return approval;
}

export function assertApproved(projectDir) {
  const file = path.join(projectDir, "approval.json");
  if (!fs.existsSync(file)) {
    throw new Error("Project is not approved. Run approve before rendering.");
  }
  const approval = readJson(file);
  if (!approval.approved) {
    throw new Error("Project is not approved. Run approve before rendering.");
  }
  const currentHash = hashProductionPackage(projectDir);
  if (approval.package_hash !== currentHash) {
    throw new Error("Project approval is stale. Review and approve the package again.");
  }
  return approval;
}
