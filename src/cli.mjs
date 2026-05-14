import path from "node:path";
import { approveProject } from "./approval.mjs";
import { importManualBgm } from "./audio.mjs";
import { composeProject } from "./compose.mjs";
import { createProjectFromScript, createProjectFromTopic } from "./project-generator.mjs";
import { renderBatch } from "./render-state.mjs";
import { renderWebWorkspace } from "./web-workspace.mjs";

const HELP = `welopc 短剧 agent

用法：
  welopc-drama-agent new --topic "白骨精不想再演反派了" --out ./projects/baigujing
  welopc-drama-agent import --script ./story.md --out ./projects/story
  welopc-drama-agent approve --project ./projects/baigujing
  welopc-drama-agent render --project ./projects/baigujing --batch 3 --resolution 480p
  welopc-drama-agent web --project ./projects/baigujing
  welopc-drama-agent bgm --project ./projects/baigujing --provider manual --file ./bgm.mp3
  welopc-drama-agent compose --project ./projects/baigujing

WelOPC 别名：
  welopc drama new --topic "..."
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        index += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function projectArg(args) {
  if (!args.project) throw new Error("--project is required");
  return path.resolve(args.project);
}

export async function runCli(argv) {
  const args = parseArgs(argv);
  const command = args._[0];

  if (!command || args.help || command === "--help" || command === "help") {
    console.log(HELP);
    return;
  }

  if (command === "new") {
    printJson(await createProjectFromTopic({
      topic: args.topic,
      outDir: args.out ? path.resolve(args.out) : undefined,
    }));
    return;
  }

  if (command === "import") {
    printJson(await createProjectFromScript({
      scriptFile: args.script,
      outDir: args.out ? path.resolve(args.out) : undefined,
    }));
    return;
  }

  if (command === "approve") {
    printJson(approveProject(projectArg(args)));
    return;
  }

  if (command === "render") {
    printJson(await renderBatch({
      projectDir: projectArg(args),
      batch: Number(args.batch || 3),
      resolution: args.resolution || "480p",
      force: Boolean(args.force),
    }));
    return;
  }

  if (command === "web") {
    printJson({ index_html: renderWebWorkspace(projectArg(args)) });
    return;
  }

  if (command === "bgm") {
    if (args.provider !== "manual") throw new Error("Only --provider manual is implemented in this version.");
    printJson(importManualBgm({ projectDir: projectArg(args), file: args.file }));
    return;
  }

  if (command === "compose") {
    printJson(composeProject({ projectDir: projectArg(args), execute: Boolean(args.execute) }));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}
