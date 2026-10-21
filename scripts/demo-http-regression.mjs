import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const port = 3197;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["scripts/run-demo.mjs", "start", "--hostname", "127.0.0.1", "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, OPENAI_API_KEY: "", DEEPSEEK_API_KEY: "", AI_PROVIDER: "" } });
let logs = "";
server.stdout.on("data", data => { logs += data; }); server.stderr.on("data", data => { logs += data; });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error("Demo server exited before readiness: " + logs);
    try { ready = (await fetch(origin)).ok; } catch { /* Loopback server is still starting. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, "demo server readiness: " + logs);
  for (const [route, text] of [
    ["/", "合成"], ["/devices", "Example"], ["/devices/example-phone-3", "Example Phone 3"],
    ["/compare", "Example"], ["/compare?mode=cross", "跨品牌"],
    ["/trends", "Example"], ["/advisor", "预算"],
  ]) {
    const response = await fetch(origin + route); assert.equal(response.status, 200, route);
    const html = await response.text(); assert.ok(html.includes(text), `${route}: expected page content`);
    assert.ok(!/<(?:img|link)[^>]+(?:src|href)=["']https?:\/\//i.test(html), `${route}: no remote images or fonts`);
  }
  const response = await fetch(`${origin}/api/device-advisor`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ budget: 5000, category: "phone", performancePreference: "balanced", useCases: ["Demo"], intent: "Demo", replacementIntent: "first_device", maxResults: 3 }) });
  assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.source, "rules"); assert.ok(result.devices.length > 0);
  console.log("loopback HTTP: four main tabs, homepage, detail, cross-brand comparison and actual rules API passed; no browser or paid API");
} finally {
  server.kill("SIGTERM");
  await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once("exit", resolve); });
}
