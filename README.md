# WelOPC Drama Agent

`welopc-drama-agent` is a CLI-first WelOPC scenario pack for AI short drama and manga-drama production.

It turns a topic or script into a structured production package, gates paid rendering behind approval, and prepares the project for batch rendering, BGM import, and ffmpeg composition.

## Install

```powershell
npm install
```

## Create A Project

```powershell
node .\bin\welopc-drama-agent.js new --topic "白骨精不想再演反派了" --out .\projects\baigujing
```

Or import an existing script:

```powershell
node .\bin\welopc-drama-agent.js import --script .\story.md --out .\projects\story
```

## Review And Approve

Open the generated `index.html`, review the production package, then approve:

```powershell
node .\bin\welopc-drama-agent.js approve --project .\projects\baigujing
```

## Prepare A Render Batch

The first implementation creates local storyboard keyframes and render state. Paid provider submission is intentionally behind the next adapter step.

```powershell
node .\bin\welopc-drama-agent.js render --project .\projects\baigujing --batch 3 --resolution 480p
```

## Import BGM

```powershell
node .\bin\welopc-drama-agent.js bgm --project .\projects\baigujing --provider manual --file .\bgm.mp3
```

## Compose

Once all clips exist in render state, prepare an ffmpeg compose plan:

```powershell
node .\bin\welopc-drama-agent.js compose --project .\projects\baigujing
```

Pass `--execute` to run ffmpeg.

## Test

```powershell
npm test
```
