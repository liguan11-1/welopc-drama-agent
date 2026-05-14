# WelOPC Drama Agent Design

## Summary

`welopc-drama-agent` is an independent WelOPC scenario pack for AI short drama and manga-drama production. It turns a topic, synopsis, script, or novel excerpt into a complete production package, then renders a finished short drama video after review.

The first version is for internal/self use. It is CLI-first so it can be installed into WelOPC scenario packs later. The Web workspace is a review and operations layer, not the source of business logic.

## Goals

- Support both topic-first creation and script-first adaptation.
- Generate a complete, reviewable production package before spending video credits.
- Render a complete short drama, normally 45-60 seconds, by processing video shots in batches.
- Keep project state resumable so failed or unfinished rendering can continue without restarting.
- Make BGM and audio creation a first-class optional module.
- Keep the local workflow usable before SaaS concerns such as login, payment, and multi-user isolation.

## Non-Goals

- No public SaaS account system in the first version.
- No payment, quota, or team permission system in the first version.
- No hard dependency on BGM generation APIs for the core video path.
- No direct full-run rendering before the production package is reviewed and approved.

## Product Shape

The package exposes CLI commands and a local Web workspace.

```powershell
welopc drama new --topic "白骨精不想再演反派了"
welopc drama import --script .\story.md
welopc drama plan --project .\projects\baigujing
welopc drama web --project .\projects\baigujing
welopc drama approve --project .\projects\baigujing
welopc drama render --project .\projects\baigujing --batch 3 --resolution 480p
welopc drama status --project .\projects\baigujing --poll
welopc drama render --project .\projects\baigujing --continue
welopc drama bgm --project .\projects\baigujing --provider manual
welopc drama compose --project .\projects\baigujing
```

The Web workspace lets the user inspect and approve the story, characters, scenes, shot list, image prompts, video prompts, render queue, audio plan, and output status.

## Architecture

```text
CLI Layer
  new / import / plan / web / approve / render / status / bgm / compose

Core Agent Layer
  StoryAgent
  CharacterAgent
  SceneAgent
  DirectorAgent
  PromptAgent
  AudioAgent
  QueueAgent
  QCAgent

Project Layer
  Reads and writes a stable local project directory.

Render Layer
  Image provider: builtin storyboard, image API, or future provider adapters.
  Video provider: Seedance API first, with optional Jimeng CLI fallback.
  Audio provider: manual audio file first, optional BGM APIs later.
  Compose provider: ffmpeg.

Web Layer
  Local project dashboard and review interface.
```

The CLI and Web workspace both use the same Project Layer. This keeps the workflow portable and makes the Web UI replaceable.

## Project Directory

Each drama project is a folder with structured files.

```text
project/
  manifest.json
  style_pack.json
  story_bible.md
  characters.json
  scenes.json
  props.json
  episode_outline.md
  shots.jsonl
  image_prompts.jsonl
  video_prompts.jsonl
  audio_plan.md
  bgm_prompts.jsonl
  sfx_prompts.jsonl
  voiceover_script.md
  render_queue.jsonl
  review_checklist.md
  approval.json
  render_state.json
  assets/
    keyframes/
    audio/
  outputs/
    clips/
    audio/
    final.mp4
  index.html
```

`approval.json` is the gate between planning and paid rendering. Video rendering commands must refuse to run unless the production package has been approved, unless the user explicitly passes a force flag.

## Workflow

### 1. Input

The user can start from either a topic or an existing script.

Topic mode expands a short idea into a logline, conflict, reversal, episode beats, and ending hook.

Script mode parses the provided material, extracts the main story arc, compresses it into a short drama structure, and preserves important character and plot constraints.

### 2. Production Package

The Core Agent Layer generates:

- story bible
- character bible
- scene bible
- prop list
- episode outline
- shot list
- image prompts
- video prompts
- audio plan
- render queue
- review checklist

The package must be human-readable and machine-readable. Markdown files are for review; JSON and JSONL files are for automation.

### 3. Review

The Web workspace shows the production package. The user reviews at least:

- story direction
- character consistency
- visual style
- shot order and duration
- prompt quality
- estimated render cost
- audio plan

The user can approve the package through CLI or Web. Approval stores a timestamp and the approved production package hash in `approval.json`.

### 4. Rendering

Rendering runs in batches, defaulting to three shots per batch. The default first full-run strategy is:

- generate or reuse keyframes
- submit Seedance image-to-video tasks
- poll status
- download finished clips
- stop after failures rather than retrying endlessly
- continue from `render_state.json`

The default resolution for low-cost internal runs is `480p`. The user can choose `720p` after the style and motion are proven.

### 5. Audio

Audio is optional but designed as a first-class module.

Default mode:

- `AudioAgent` creates `audio_plan.md`, `bgm_prompts.jsonl`, `sfx_prompts.jsonl`, and `voiceover_script.md`.
- The user can place a local BGM file at `assets/audio/bgm.mp3`.
- `compose` mixes the BGM into the final video with ffmpeg.

Optional BGM API mode:

```powershell
welopc drama bgm --project .\projects\baigujing --provider minimax
```

The provider adapter creates `outputs/audio/bgm.mp3` and records state in `render_state.json`. Providers can include Minimax, Mureka, Suno, Udio, or other future APIs, but none are required for MVP completion.

### 6. Compose

`compose` uses ffmpeg to concatenate clips and optionally mix BGM.

The command must verify:

- all required clips exist
- clip order matches `shots.jsonl`
- output dimensions are even and compatible with H.264
- BGM exists only if audio mixing is requested
- final output is written to `outputs/final.mp4`

## Cost And Failure Controls

- Rendering cannot run before approval by default.
- Batch size defaults to three shots.
- The first internal run should use `480p`.
- Failed tasks are recorded with error messages and retry counts.
- Automatic retry is limited to one retry per shot.
- After two failures, the shot enters manual review.
- `status --poll` can resume existing task ids without submitting new tasks.
- `render --continue` only submits missing or failed-approved tasks.

## Existing Assets To Reuse

The first implementation should reuse current workspace assets:

- `docs/one_click_manga_automation_blueprint.md`
- `prompts/manga_one_click_master_prompt.md`
- `prompts/style_d_dark_myth_manga.json`
- `scripts/create_manga_demo_baigujing.js`
- `scripts/render_manga_project.js`
- `demo/manga-agent-demo/baigujing-kpi/`
- `liblib_project_detail.json`
- `liblib_canvas_visual_report.md`

The current Bai Gu Jing project should become the first sample pack and regression fixture.

## MVP Acceptance Criteria

The MVP is complete when:

1. A topic can create a complete project directory.
2. A script file can create a complete project directory.
3. The project includes story, characters, scenes, shots, prompts, audio plan, render queue, and review checklist.
4. A local Web workspace can display the package and approve it.
5. Rendering refuses to run before approval.
6. Rendering can submit batches of video tasks after approval.
7. Status polling can resume and download clips.
8. Compose can create `outputs/final.mp4`.
9. Optional BGM can be mixed when a local BGM file exists.
10. Failures are recorded and resumable without rebuilding the project.

## First Implementation Scope

Provider adapters stay pluggable, but the first implementation must use this minimal adapter set:

- Seedance video API
- builtin storyboard keyframe generator
- local BGM import
- ffmpeg compose

Other image, video, and BGM providers can be added after the core project format is stable.
