import fs from "node:fs";
import path from "node:path";
import { readJson, readJsonl, writeText } from "./files.mjs";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readOptional(file, fallback = "") {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : fallback;
}

export function renderWebWorkspace(projectDir) {
  const manifest = readJson(path.join(projectDir, "manifest.json"));
  const shots = readJsonl(path.join(projectDir, "shots.jsonl"));
  const queue = readJsonl(path.join(projectDir, "render_queue.jsonl"));
  const story = readOptional(path.join(projectDir, "story_bible.md"));
  const audio = readOptional(path.join(projectDir, "audio_plan.md"));
  const approvalFile = path.join(projectDir, "approval.json");
  const approval = fs.existsSync(approvalFile) ? readJson(approvalFile) : { approved: false };

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(manifest.title)} - WelOPC Drama Agent</title>
  <style>
    body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; background: #10131a; color: #eef1f5; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px; }
    section { border-top: 1px solid #2a3140; padding: 24px 0; }
    h1, h2 { margin: 0 0 12px; }
    .meta, .card { background: #171c26; border: 1px solid #2a3140; border-radius: 8px; padding: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
    .shot { border-left: 3px solid #caa85f; }
    code { color: #e9c46a; }
    pre { white-space: pre-wrap; color: #cfd7e3; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(manifest.title)}</h1>
    <div class="meta">Topic: ${escapeHtml(manifest.topic)} | Mode: ${escapeHtml(manifest.input_mode)} | Duration: ${manifest.duration_sec}s</div>
    <section>
      <h2>Approval</h2>
      <p>${approval.approved ? "Approved" : "Not approved"}</p>
    </section>
    <section>
      <h2>Story</h2>
      <pre>${escapeHtml(story)}</pre>
    </section>
    <section>
      <h2>Shots</h2>
      <div class="grid">${shots.map((shot) => `<div class="card shot"><h3>${escapeHtml(shot.shot_id)}</h3><p>${escapeHtml(shot.beat)}</p><p>${escapeHtml(shot.visual_action)}</p><code>${escapeHtml(shot.camera_motion)}</code></div>`).join("")}</div>
    </section>
    <section>
      <h2>Render Queue</h2>
      <div class="grid">${queue.slice(0, 12).map((task) => `<div class="card"><h3>${escapeHtml(task.task_id)}</h3><p>${escapeHtml(task.task_type)} / ${escapeHtml(task.provider)}</p></div>`).join("")}</div>
    </section>
    <section>
      <h2>Audio Plan</h2>
      <pre>${escapeHtml(audio)}</pre>
    </section>
  </main>
</body>
</html>`;

  const file = path.join(projectDir, "index.html");
  writeText(file, html);
  return file;
}
