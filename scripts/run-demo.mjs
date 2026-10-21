import fs from "node:fs";
import { spawn } from "node:child_process";
const args = process.argv.slice(2);
if (!["dev", "build", "start"].includes(args[0])) throw new Error("Expected dev, build or start");
for (const name of fs.readdirSync(".")) {
  if (name.startsWith(".env") && name !== ".env.example") throw new Error("This synthetic distribution refuses real environment files");
}
const env = { ...process.env, OPENAI_API_KEY: "", DEEPSEEK_API_KEY: "", AI_PROVIDER: "", NEXT_TELEMETRY_DISABLED: "1" };
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...args], { stdio: "inherit", env });
child.on("error", error => { throw error; });
child.on("exit", code => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
