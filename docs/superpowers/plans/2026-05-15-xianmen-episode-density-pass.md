# Xianmen Episode Density Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework episode 1 from a slow 22-shot outline into a denser 37-shot short-drama production package without naming any external reference platform.

**Architecture:** This is a project-data revision, not a CLI feature. The episode files keep the existing JSON/JSONL contracts while replacing slow single-action shots with short-cut, multi-angle, character-driven beats.

**Tech Stack:** Markdown, JSON, JSONL, existing `welopc-drama-agent` validation, imagegen package refresh, approval flow, and Node test suite.

---

### Task 1: Rewrite Episode Timing

**Files:**
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/shots.jsonl`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/video_prompts.jsonl`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/image_prompts.jsonl`

- [x] **Step 1: Replace 22-shot pacing with 37 short cuts**

Use 70 seconds total, average under 2 seconds per shot, keep `E01_S011` as the low-cost Seedance test shot, and preserve key anchors: `E01_S010` eye reflection, `E01_S011` cloud boat reveal, `E01_S016` queue/pouch, `E01_S021` lift.

- [x] **Step 2: Add more character information**

Add visible details about Lin Xi's sky obsession, her pouch, village gossip, Wen Gengran's concealment, the envoy's procedural coldness, and the spirit mirror hook.

- [x] **Step 3: Rebuild video prompts**

Keep one Seedance task per shot, with concise motion instructions and warnings against scene jumps, face drift, and over-complex action.

### Task 2: Make Production Rules Source-Neutral

**Files:**
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/README.md`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/PLAN.md`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/PRODUCTION_BOARD.md`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/review_checklist.md`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/workflow_board.json`
- Modify: `docs/superpowers/plans/2026-05-15-xianmen-production-board-workflow.md`

- [x] **Step 1: Remove source framing**

Remove source-oriented wording. State the concrete production rules directly: asset pool before paid video, 10-18 internal visual beats per long node, QA labels, and short-cut pacing.

- [x] **Step 2: Update current-state docs**

Change episode 1 counts from 22 shots to 37 shots and describe it as a dense 70-second short-drama episode.

### Task 3: Refresh Derived Assets and Approval

**Files:**
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/imagegen_prompts.jsonl`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/imagegen_manifest.json`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/imagegen_workflow.md`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/index.html`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/approval.json`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/render_state.json`

- [x] **Step 1: Run image prompt refresh**

Run `node .\bin\welopc-drama-agent.js images --project .\projects\wo-zai-xianmen-dang-waimen-dizi` so Codex imagegen prompt counts match the 37-shot package.

- [x] **Step 2: Rebuild web and approval state**

Run `web`, `approve`, and a dry-run `render --batch 1 --resolution 480p` to confirm the first Seedance candidate remains `E01_S011_video_v01`.

### Task 4: Verify and Ship

**Files:**
- Verify project JSON and JSONL files.
- Run `npm test`.
- Commit and push the finished change.

- [x] **Step 1: Validate JSON/JSONL**

Run a Node validation script over the project package and assert there are 37 shots totaling 70 seconds.

- [x] **Step 2: Run tests**

Run `npm test` and require all tests to pass.

- [x] **Step 3: Commit and push**

Commit the project-data revision and push to `origin/main`.
