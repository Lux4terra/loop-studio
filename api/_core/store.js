// Loop Studio · records. Every record is a JSON file in the private data repo (LOOP_DATA_REPO), and every save is a
// commit carrying who saved it and why. Reads are cached per warm instance and
// checked with their ETag, so an unchanged file costs no rate limit; within one call a file is fetched once; saving
// always reads fresh and, if someone saved first, reads again and re-applies the same change.
import { AsyncLocalStorage } from "node:async_hooks";
import { clean, fail, sleep, copyOf } from "./util.js";

export function makeStore(E) {
  const REPO = () => String(E.LOOP_DATA_REPO || "").trim();
  const TOKEN = () => String(E.LOOP_GITHUB_TOKEN || "").trim();
  const ALS = new AsyncLocalStorage();
  const RC = new Map(); // path -> { etag, data, sha, at }
  const memo = () => { const s = ALS.getStore(); return s && s.memo; };
  const encPath = p => p.split("/").map(encodeURIComponent).join("/");
  const parse64 = c => JSON.parse(Buffer.from(String(c).replace(/\n/g, ""), "base64").toString("utf8"));

  async function gh(path, opts = {}) {
    for (let i = 0; ; i++) {
      const r = await fetch("https://api.github.com" + path, {
        method: opts.method, body: opts.body,
        headers: { Authorization: "Bearer " + TOKEN(), Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "loop-studio",
          ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(opts.etag ? { "If-None-Match": opts.etag } : {}) }
      });
      // a short wait and a second try when GitHub asks for one (secondary limits), never a loop
      if ((r.status === 403 || r.status === 429) && i < 2 && (r.headers.get("retry-after") || r.headers.get("x-ratelimit-remaining") !== "0")) {
        await sleep(Math.min(4000, (+r.headers.get("retry-after") || 1.5) * 1000)); continue;
      }
      if (r.status === 304) return { status: 304, ok: true, j: null };
      let j = null; try { j = await r.json(); } catch (_) {}
      return { status: r.status, ok: r.ok, j, etag: r.headers.get("etag") };
    }
  }
  function ghText(r) {
    if (r.status === 429 || (r.status === 403 && /rate limit/i.test(String((r.j || {}).message || "")))) return "Studio is busy. Try again in a minute.";
    if (r.status === 401) return "The data key is not valid (LOOP_GITHUB_TOKEN).";
    if (r.status === 403) return "The data key cannot write to " + REPO() + ".";
    if (r.status === 404) return "The data repo " + REPO() + " was not found.";
    return "The data store answered " + r.status + ".";
  }

  async function read(path, fresh) {
    const M = memo();
    if (!fresh && M && M.has(path)) { const m = M.get(path); return m ? { data: copyOf(m.data), sha: m.sha } : null; }
    const c = RC.get(path);
    const r = await gh(`/repos/${REPO()}/contents/${encPath(path)}`, c ? { etag: c.etag } : {});
    if (r.status === 304 && c) { c.at = Date.now(); if (M) M.set(path, { data: c.data, sha: c.sha }); return { data: copyOf(c.data), sha: c.sha }; }
    // a missing file, or an empty repo, reads as "not saved yet"
    if (r.status === 404 || (r.status === 409 && /empty/i.test(String((r.j || {}).message || "")))) { RC.delete(path); if (M) M.set(path, null); return null; }
    if (!r.ok) throw fail(502, ghText(r));
    let data;
    if (r.j.content) data = parse64(r.j.content);
    else { const b = await gh(`/repos/${REPO()}/git/blobs/${r.j.sha}`); if (!b.ok) throw fail(502, ghText(b)); data = parse64(b.j.content); } // files over 1 MB
    if (r.etag) {
      RC.set(path, { etag: r.etag, data, sha: r.j.sha, at: Date.now() });
      if (RC.size > 200) [...RC.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 40).forEach(([k]) => RC.delete(k));
    }
    if (M) M.set(path, { data, sha: r.j.sha });
    return { data: copyOf(data), sha: r.j.sha };
  }

  async function write(path, data, sha, message, who) {
    RC.delete(path); const M = memo(); if (M) M.delete(path);
    const content = Buffer.from(JSON.stringify(data, null, 1)).toString("base64");
    return gh(`/repos/${REPO()}/contents/${encPath(path)}`, {
      method: "PUT",
      body: JSON.stringify({ message: clean(message, 160), content, ...(sha ? { sha } : {}),
        committer: { name: clean(who || "Studio", 40) + " via Loop Studio", email: "studio@loop-studio.invalid" } })
    });
  }

  // Read, change, write. fn changes the data in place; returning false saves nothing.
  async function mutate(path, def, fn, message, who) {
    for (let i = 0; i < 5; i++) {
      const f = await read(path, true);
      if (!f && !def) throw fail(404, "Not set up yet.");
      const data = f ? f.data : def();
      const out = await fn(data);
      if (out === false) return data;
      const w = await write(path, data, f && f.sha, typeof message === "function" ? message(data) : message, who);
      if (w.ok) { const M = memo(), s2 = w.j && w.j.content && w.j.content.sha; if (M && s2) M.set(path, { data: copyOf(data), sha: s2 }); return data; }
      if (w.status !== 409 && w.status !== 422) throw fail(502, ghText(w));
      await sleep(250 + i * 300);
    }
    throw fail(409, "Busy saving. Try again in a moment.");
  }

  const load = async (path, def) => ((await read(path)) || { data: def() }).data;
  const ready = () => !!(REPO() && TOKEN());
  // every call runs with its own memo, so a file is fetched once per call
  const run = fn => ALS.run({ memo: new Map() }, fn);
  return { read, write, mutate, load, ready, run };
}
