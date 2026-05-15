# Xianmen Sci-Fantasy Reference Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the xianmen short-drama project so character references, image prompts, video prompts, and packed Seedance nodes express a cinematic sci-fantasy look with strong first-two-second retention.

**Architecture:** Keep the existing project file layout and JSONL contracts. Add two focused rule documents, update style/QA metadata, then mechanically enrich prompt files from the source-locked shot list so prompt wording stays consistent with the novel.

**Tech Stack:** Markdown project docs, JSON, JSONL, Node.js file transformation, existing `npm test` and `welopc-drama-agent preflight`.

---

### Task 1: Document The Visual Method

**Files:**
- Create: `projects/wo-zai-xianmen-dang-waimen-dizi/SCI_FANTASY_STYLE_REVERSE_ENGINEERING.md`
- Create: `projects/wo-zai-xianmen-dang-waimen-dizi/RETENTION_CINEMATIC_RULES.md`

- [x] **Step 1: Write the external-case method summary**

Document that the reference method uses fewer but denser shots: each shot has composition, spatial relation, concrete detail, light, lens, motion, physical dynamics, and sound cues.

- [x] **Step 2: Write project-specific retention rules**

Define cold open, anomaly, rule setup, pressure build, turning point, emotional payoff, and cliffhanger for E01.

### Task 2: Upgrade Project Style And QA Rules

**Files:**
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/style_pack.json`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/qa_rules.json`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/CHARACTER_PROMPT_SYSTEM.md`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/video_node_packing_rules.md`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/E01_REWRITE_PLAN.md`

- [x] **Step 1: Update visual style pack**

Set the visual identity to ancient xianmen plus jade-silver sci-fantasy technology, with village realism before cloud-boat arrival.

- [x] **Step 2: Add QA tags**

Add checks for weak first-two-second hook, generic AI look, sci-fantasy underpower, overmodern sci-fi, low character attractiveness, and insufficient cinematic layering.

- [x] **Step 3: Update character and packing rules**

Make character attractiveness come from silhouette, personality, costume layers, and props; make every packed node carry a retention hook and multi-beat motion prompt.

### Task 3: Enrich Prompts From Source-Locked Shots

**Files:**
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/imagegen_prompts.jsonl`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/image_prompts.jsonl`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/video_prompts.jsonl`
- Modify: `projects/wo-zai-xianmen-dang-waimen-dizi/video_node_packing_plan.jsonl`

- [x] **Step 1: Enrich character reference prompts**

Add sci-fantasy attractiveness, silhouette, and anti-generic constraints without changing novel facts.

- [x] **Step 2: Enrich video reference image prompts**

For each shot, add two-second hook, character lock, scene material, composition, light, and negative constraints.

- [x] **Step 3: Enrich video motion prompts**

For each shot, generate a bracketed prompt with hook, shot target, character lock, scene look, camera language, motion rhythm, and audio policy.

- [x] **Step 4: Enrich packed node prompts**

For each 5-second Seedance pack, add retention hook, style prompt, and motion prompt based on its visual beats.

### Task 4: Verify

**Files:**
- Test: `package.json`
- Test: `src/preflight.mjs`

- [x] **Step 1: Run unit tests**

Run: `npm test`

Expected: all tests pass. Verified: 49 tests passed.

- [x] **Step 2: Run project preflight**

Run: `node .\bin\welopc-drama-agent.js preflight --project .\projects\wo-zai-xianmen-dang-waimen-dizi`

Expected: no JSON parse errors. It is acceptable for reference frames to remain missing before image generation. Verified: preflight completed; project is not approved and most video reference frames are still missing, which is expected before the next imagegen pass.
