// Loop Studio · a local stand-in for Vercel and GitHub, to test Studio end to end (KERUB OS's dev server, stripped).
// Serves public/ as Vercel does, runs api/studio.js, answers GitHub's contents API from memory, and stands in for the
// free models (Gemini and Groq), recording every prompt so tests can say what left and what did not.
// /__mock (GET) shows the files, commits and model calls; (POST) {reset}, {put:{path,data}}, {env:{...}}, {empty:true},
// {aiDown:{gemini,groq}}, {aiText:"..."}, {aiCut:true} change it. Model keys start unset, as in a fresh Vercel project.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const ROOT = process.argv[2];
const PORT = +process.argv[3] || 8791;
// test values only, never real keys
Object.assign(process.env, { LOOP_DATA_REPO: "Lux4terra/loop-data", LOOP_GITHUB_TOKEN: "test-data-token", STUDIO_KEY: "test-studio-key-0123456789" });

const files = {}, blobs = {}, commits = [];
const mock = { ghCalls: 0, gh304: 0, empty: false, ai: [], aiDown: { gemini: false, groq: false }, aiText: null, aiCut: false };
const AI_KEYS = { GEMINI_API_KEY: "test-gemini-key", GROQ_API_KEY: "test-groq-key" }; // test values only
const PRD = "Summary\nA module that tracks every build side by side.\n\nUsers\n- The studio lead, on a phone.\n\nGoals\n- See where each build stands.\n\nScope\n- Builds read from GitHub.\n\nOut of scope\n- Merging.\n\nRequirements\n- Show the branch, the last commit and the suite status.\n\nRisks and open questions\n- Rate limits on reading commits.";
function model(provider, url, init) {
  const b = JSON.parse(init.body);
  const rec = provider === "gemini"
    ? { provider, model: decodeURIComponent(url.split("/models/")[1].split(":")[0]), sys: b.systemInstruction.parts[0].text, prompt: b.contents[0].parts[0].text, key: init.headers["x-goog-api-key"], thinking: b.generationConfig.thinkingConfig }
    : { provider, model: b.model, sys: b.messages[0].content, prompt: b.messages[1].content, key: String(init.headers.Authorization || "").replace("Bearer ", "") };
  mock.ai.push(rec);
  if (mock.aiDown[provider]) return J(503, { error: { message: "unavailable" } });
  const text = mock.aiText == null ? PRD : mock.aiText;
  return provider === "gemini"
    ? J(200, { candidates: [{ content: { parts: [{ text }] }, finishReason: mock.aiCut ? "MAX_TOKENS" : "STOP" }] })
    : J(200, { choices: [{ message: { content: text }, finish_reason: mock.aiCut ? "length" : "stop" }] });
}
const b64 = t => Buffer.from(t).toString("base64").replace(/(.{60})/g, "$1\n");
const J = (status, obj, h = {}) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...h } });
function github(url, init) {
  mock.ghCalls++;
  const u = new URL(url), p = decodeURIComponent(u.pathname);
  const m = p.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (!m || init.headers.Authorization !== "Bearer " + process.env.LOOP_GITHUB_TOKEN || process.env.LOOP_GITHUB_TOKEN !== "test-data-token") return J(401, { message: "Bad credentials" });
  if (m[1] + "/" + m[2] !== "Lux4terra/loop-data") return J(404, { message: "Not Found" });
  const rest = m[3] || "";
  let x;
  if ((x = rest.match(/^\/contents\/(.+)$/))) {
    const fp = x[1];
    if ((init.method || "GET") === "GET") {
      if (mock.empty && !Object.keys(files).length) return J(404, { message: "This repository is empty." });
      const f = files[fp]; if (!f) return J(404, { message: "Not Found" });
      if (init.headers["If-None-Match"] === '"' + f.sha + '"') { mock.gh304++; return new Response(null, { status: 304 }); }
      return J(200, { content: b64(f.text), sha: f.sha, size: f.text.length }, { ETag: '"' + f.sha + '"' });
    }
    if (init.method === "PUT") {
      const b = JSON.parse(init.body), cur = files[fp];
      if (cur && !b.sha) return J(422, { message: "sha wasn't supplied" });
      if (cur && b.sha !== cur.sha) return J(409, { message: "does not match" });
      if (!cur && b.sha) return J(409, { message: "does not match" });
      const bin = Buffer.from(b.content, "base64"), text = bin.toString("utf8");
      const sha = crypto.createHash("sha1").update("blob " + bin.length + "\0").update(bin).digest("hex");
      blobs[sha] = text; files[fp] = { text, sha };
      const c = { sha: crypto.randomBytes(20).toString("hex"), message: b.message, date: new Date().toISOString(), path: fp, by: b.committer && b.committer.name, email: b.committer && b.committer.email };
      commits.push(c);
      return J(200, { content: { sha }, commit: { sha: c.sha } });
    }
  }
  if ((x = rest.match(/^\/git\/blobs\/([0-9a-f]+)$/))) { const t = blobs[x[1]]; return t ? J(200, { content: b64(t) }) : J(404, { message: "Not Found" }); }
  return J(404, { message: "Not Found" });
}
const realFetch = globalThis.fetch;
const outside = [];
globalThis.fetch = async (url, init = {}) => {
  const s = String(url);
  if (s.startsWith("https://api.github.com")) return github(s, init);
  if (s.startsWith("https://generativelanguage.googleapis.com/")) return model("gemini", s, init);
  if (s.startsWith("https://api.groq.com/")) return model("groq", s, init);
  outside.push(s); // anything else the server reaches for is recorded, so tests can say nothing leaves
  return realFetch(url, init);
};

const { default: handler } = await import(pathToFileURL(path.join(ROOT, "api/studio.js")).href);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json", ".svg": "image/svg+xml" };
const PUB = path.join(ROOT, "public");
const VJ = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const HDRS = p => VJ.headers.filter(h => new RegExp("^" + h.source.replace(/\(\.\*\)/g, ".*") + "$").test(p)).flatMap(h => h.headers);

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  for (const h of HDRS(u.pathname)) res.setHeader(h.key, h.value);
  if (u.pathname === "/__mock") {
    if (req.method === "POST") {
      let b = ""; for await (const c of req) b += c; const o = JSON.parse(b || "{}");
      if (o.reset) { for (const k in files) delete files[k]; for (const k in blobs) delete blobs[k]; commits.length = 0; outside.length = 0; mock.empty = false; mock.ghCalls = 0; mock.gh304 = 0;
        mock.ai = []; mock.aiDown = { gemini: false, groq: false }; mock.aiText = null; mock.aiCut = false; for (const k in AI_KEYS) delete process.env[k]; delete o.reset; }
      if (o.aiKeys) { Object.assign(process.env, AI_KEYS); delete o.aiKeys; }
      if (o.put) { const text = JSON.stringify(o.put.data), sha = crypto.createHash("sha1").update(text).digest("hex"); blobs[sha] = text; files[o.put.path] = { text, sha }; delete o.put; }
      if (o.env) { Object.assign(process.env, o.env); for (const [k, v] of Object.entries(o.env)) if (v === null) delete process.env[k]; delete o.env; }
      Object.assign(mock, o);
    }
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ...mock, outside, files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, { sha: v.sha, data: JSON.parse(v.text) }])), commits }));
  }
  if (u.pathname === "/api/studio") {
    let raw = ""; for await (const c of req) raw += c;
    req.query = Object.fromEntries(u.searchParams);
    req.body = /json/.test(req.headers["content-type"] || "") && raw ? JSON.parse(raw) : raw || undefined;
    return handler(req, res);
  }
  for (const r of VJ.redirects) if (u.pathname === r.source) { res.writeHead(r.permanent ? 308 : 307, { Location: r.destination }); return res.end(); }
  const fp = path.join(PUB, u.pathname.endsWith("/") ? u.pathname + "index.html" : u.pathname);
  if (!fp.startsWith(PUB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream" });
  fs.createReadStream(fp).pipe(res);
}).listen(PORT, () => console.log("studio dev on", PORT));
