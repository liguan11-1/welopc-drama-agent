# WelOPC Drama Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first shippable `welopc-drama-agent` package with CLI-first project generation, approval gating, local Web review, BGM import, and ffmpeg composition.

**Architecture:** A Node.js package exposes `welopc-drama-agent` and `welopc-drama` bin commands. Core modules generate and validate project files; CLI commands call core modules; the Web workspace is generated as static HTML from the same project files.

**Tech Stack:** Node.js ESM, built-in `node:test`, JSON/JSONL/Markdown files, ffmpeg for composition.

---

### Task 1: Package And CLI Skeleton

**Files:**
- Create: `package.json`
- Create: `bin/welopc-drama-agent.js`
- Create: `src/cli.mjs`
- Test: `test/cli.test.mjs`

- [ ] **Step 1: Write failing CLI help test**

```js
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
```

- [ ] **Step 2: Run test and verify it fails**

Run: `node --test test/cli.test.mjs`

Expected: FAIL because the CLI files do not exist.

- [ ] **Step 3: Implement package and CLI help**

Create `package.json` with package metadata, bin entries, and `npm test`.

Create `bin/welopc-drama-agent.js` as a Node executable that imports `src/cli.mjs`.

Create `src/cli.mjs` with argument parsing and help output.

- [ ] **Step 4: Run test and verify it passes**

Run: `node --test test/cli.test.mjs`

Expected: PASS.

### Task 2: Project Generation

**Files:**
- Create: `src/project-generator.mjs`
- Create: `src/files.mjs`
- Modify: `src/cli.mjs`
- Test: `test/project-generator.test.mjs`

- [ ] **Step 1: Write failing project generation tests**

Tests must verify that topic mode creates a project directory with `manifest.json`, `shots.jsonl`, `video_prompts.jsonl`, `audio_plan.md`, `render_queue.jsonl`, and `index.html`.

- [ ] **Step 2: Run test and verify it fails**

Run: `node --test test/project-generator.test.mjs`

Expected: FAIL because generator functions do not exist.

- [ ] **Step 3: Implement deterministic generator**

Implement `createProjectFromTopic()` and `createProjectFromScript()` using deterministic templates. Both must create a 9-shot, 45-second project by default.

- [ ] **Step 4: Wire CLI commands**

Add:

```powershell
welopc-drama-agent new --topic "..." --out ./project
welopc-drama-agent import --script ./story.md --out ./project
```

- [ ] **Step 5: Run test and verify it passes**

Run: `node --test test/project-generator.test.mjs`

Expected: PASS.

### Task 3: Approval Gate And Render Planning

**Files:**
- Create: `src/approval.mjs`
- Create: `src/render-state.mjs`
- Modify: `src/cli.mjs`
- Test: `test/approval.test.mjs`

- [ ] **Step 1: Write failing approval tests**

Tests must verify that rendering refuses before approval and that `approve` creates `approval.json` with a project hash.

- [ ] **Step 2: Run test and verify it fails**

Run: `node --test test/approval.test.mjs`

Expected: FAIL because approval functions do not exist.

- [ ] **Step 3: Implement approval functions**

Implement `approveProject()`, `assertApproved()`, and `hashProductionPackage()`.

- [ ] **Step 4: Wire CLI commands**

Add:

```powershell
welopc-drama-agent approve --project ./project
welopc-drama-agent render --project ./project --batch 3 --resolution 480p
```

`render` should create local storyboard keyframes and update `render_state.json`. It should not call paid APIs in this first code push.

- [ ] **Step 5: Run test and verify it passes**

Run: `node --test test/approval.test.mjs`

Expected: PASS.

### Task 4: Web Workspace And Audio

**Files:**
- Create: `src/web-workspace.mjs`
- Create: `src/audio.mjs`
- Modify: `src/cli.mjs`
- Test: `test/web-audio.test.mjs`

- [ ] **Step 1: Write failing Web and audio tests**

Tests must verify that `index.html` includes story, shots, approval status, render queue, and audio plan. Tests must verify that `bgm --provider manual --file bgm.mp3` copies the file into `assets/audio/bgm.mp3`.

- [ ] **Step 2: Run test and verify it fails**

Run: `node --test test/web-audio.test.mjs`

Expected: FAIL because Web and audio modules do not exist.

- [ ] **Step 3: Implement Web and audio modules**

Generate static `index.html` from project files. Implement manual BGM import.

- [ ] **Step 4: Run test and verify it passes**

Run: `node --test test/web-audio.test.mjs`

Expected: PASS.

### Task 5: Compose Command

**Files:**
- Create: `src/compose.mjs`
- Modify: `src/cli.mjs`
- Test: `test/compose.test.mjs`

- [ ] **Step 1: Write failing compose tests**

Tests must verify that compose refuses when clips are missing and writes an ffmpeg concat list when clips exist.

- [ ] **Step 2: Run test and verify it fails**

Run: `node --test test/compose.test.mjs`

Expected: FAIL because compose module does not exist.

- [ ] **Step 3: Implement compose planning**

Implement `planCompose()` and `composeProject()`. `composeProject()` should run ffmpeg only when `--execute` is passed; otherwise it writes a dry-run plan.

- [ ] **Step 4: Run full tests**

Run: `npm test`

Expected: PASS.

### Task 6: Documentation And Push

**Files:**
- Create: `README.md`
- Create: `.gitignore`

- [ ] **Step 1: Add usage docs**

Document the internal workflow:

```powershell
npm install
node .\bin\welopc-drama-agent.js new --topic "白骨精不想再演反派了" --out .\projects\baigujing
node .\bin\welopc-drama-agent.js approve --project .\projects\baigujing
node .\bin\welopc-drama-agent.js render --project .\projects\baigujing --batch 3 --resolution 480p
node .\bin\welopc-drama-agent.js bgm --project .\projects\baigujing --provider manual --file .\bgm.mp3
node .\bin\welopc-drama-agent.js compose --project .\projects\baigujing
```

- [ ] **Step 2: Verify**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Commit and push**

Stage only package files, source files, tests, README, `.gitignore`, and this plan. Commit with `feat: add drama agent cli`.

Push to `origin/main`.
