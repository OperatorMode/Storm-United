// Phone-sized screenshots of the local app for the in-app guide.
// Usage: node capture.mjs shots.json outDir
// Each shot: { name, url, cookies?: {name: value}, manager?: "id", js?: "code run after load", wait?: ms, full?: true }
// manager: signed in as that manager account (needs the local server's SESSION_SECRET, default "localtest").
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [shotsFile, outDir] = process.argv.slice(2);
const shots = JSON.parse(readFileSync(shotsFile, "utf8"));
mkdirSync(outDir, { recursive: true });

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
const profile = join(process.env.TEMP, "sidelnr-guide-profile-" + Date.now());
const browser = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let version;
for (let i = 0; i < 40 && !version; i++) {
  try {
    version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  } catch {
    await sleep(250);
  }
}
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  } else events.push(msg);
};
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const s = (method, params) => send(method, params, sessionId);
await s("Page.enable");
await s("Network.enable");
await s("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await s("Emulation.setUserAgentOverride", {
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});
await s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });

for (const shot of shots) {
  await s("Network.clearBrowserCookies");
  const origin = new URL(shot.url).origin;
  const cookies = { ...(shot.cookies ?? {}) };
  if (shot.manager) {
    const payload = `${shot.manager}.${Date.now() + 24 * 3600_000}`;
    cookies.su_mgr = `${payload}.${createHmac("sha256", process.env.SESSION_SECRET ?? "localtest").update(payload).digest("base64url")}`;
  }
  for (const [name, value] of Object.entries(cookies)) {
    await s("Network.setCookie", { name, value, url: origin, path: "/" });
  }
  await s("Page.navigate", { url: shot.url });
  await sleep(shot.wait ?? 2500);
  if (shot.js) {
    const r = await s("Runtime.evaluate", { expression: `(async () => { ${shot.js} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) console.error(shot.name, "js error", JSON.stringify(r.exceptionDetails).slice(0, 300));
    await sleep(shot.after ?? 800);
  }
  // full: the whole page, top to bottom (for pictures you can scroll through when zoomed).
  if (shot.full) {
    const { cssContentSize } = await s("Page.getLayoutMetrics");
    await s("Emulation.setDeviceMetricsOverride", { width: 390, height: Math.ceil(cssContentSize.height), deviceScaleFactor: 2, mobile: true });
    await sleep(800);
  }
  const { data } = await s("Page.captureScreenshot", { format: "webp", quality: 82 });
  if (shot.full) await s("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  writeFileSync(join(outDir, `${shot.name}.webp`), Buffer.from(data, "base64"));
  console.log("saved", shot.name);
}
await send("Browser.close").catch(() => {}); // or the next run would reuse this browser
browser.kill();
process.exit(0);
