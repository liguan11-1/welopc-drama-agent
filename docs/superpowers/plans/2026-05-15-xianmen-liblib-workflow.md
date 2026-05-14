# Xianmen LibTV Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the `wo-zai-xianmen-dang-waimen-dizi` short-drama case package with a LibTV-style visual production board and pre-video experiment queue.

**Architecture:** Keep this as a project-data change, not a new CLI feature. The new files live inside the project package and define board lanes, experiment records, image-generation prompt batches, and QA gates that can later be automated by the CLI.

**Tech Stack:** Markdown, JSON, JSONL, existing `welopc-drama-agent` CLI validation and approval flow.

---

### Task 1: Add Production Board

**Files:**
- Create: `projects/wo-zai-xianmen-dang-waimen-dizi/PRODUCTION_BOARD.md`
- Create: `projects/wo-zai-xianmen-dang-waimen-dizi/workflow_board.json`

- [x] **Step 1: Capture LibTV case facts**

Record the local reference files, node counts, and the core insight that video generation should follow image/resource experimentation.

- [x] **Step 2: Map board lanes**

Create lanes for content design, character consistency, scene moodboard, lighting tests, fusion tests, multicam tests, video reference frames, Seedance execution, audio design, and QA review.

- [x] **Step 3: Save machine-readable state**

Write `workflow_board.json` with inputs, outputs, status, and cost guard notes.

### Task 2: Add Experiment Queues

**Files:**
- Create: `projects/wo-zai-xianmen-dang-waimen-dizi/experiments.jsonl`
- Create: `projects/wo-zai-xianmen-dang-waimen-dizi/character_prompts.jsonl`
- Create: `projects/wo-zai-xianmen-dang-waimen-dizi/moodboard_prompts.jsonl`
- Create: `projects/wo-zai-xianmen-dang-waimen-dizi/fusion_prompts.jsonl`
- Create: `projects/wo-zai-xianmen-dang-waimen-dizi/multicam_prompts.jsonl`
- Create: `projects/wo-zai-xianmen-dang-waimen-dizi/qa_rules.json`

- [x] **Step 1: Define experiment records**

Add experiment records with `experiment_id`, `lane_id`, `priority`, `target_path`, source assets, prompt refs, and QA focus tags.

- [x] **Step 2: Add prompt batches**

Add dedicated prompt files for character action sheets, scene moodboards, lighting tests, character-scene fusion, and 3x3 multicam exploration.

- [x] **Step 3: Add QA rules**

Define review tags such as `face_drift`, `costume_drift`, `too_scifi`, `motion_overload`, and `usable_for_seedance`.

### Task 3: Wire Docs and Queue

**Files:**
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/README.md`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/PLAN.md`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/render_queue.jsonl`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/review_checklist.md`

- [x] **Step 1: Update README workflow**

Document that the project now follows asset experiments, human review, then paid Seedance execution.

- [x] **Step 2: Update production plan**

Add the new files and priority experiments to the next-step plan.

- [x] **Step 3: Update queue**

Insert the highest-priority Codex imagegen experiments before bulk video-reference generation.

### Task 4: Verify

**Files:**
- Verify all project JSON and JSONL files.
- Run the existing CLI test suite.

- [x] **Step 1: Validate data files**

Run a Node validation script over JSON and JSONL files.

- [x] **Step 2: Re-approve package**

Run `node .\bin\welopc-drama-agent.js approve --project .\projects\wo-zai-xianmen-dang-waimen-dizi`.

- [x] **Step 3: Run tests**

Run `npm test` and require all tests to pass before committing.
