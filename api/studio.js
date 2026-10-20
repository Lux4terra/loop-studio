// Loop Studio · the API. One person signs in; their records live in the private data repo, every save a commit.
// The core keeps sign-in, the account, appearance and the notification centre; everything else is a module from
// modules/, plugged in through the registry (api/_core/registry.js), each with its own contract, routes and records.
import { makeStore } from "./_core/store.js";
import { makeAuth } from "./_core/auth.js";
import { makeRegistry } from "./_core/registry.js";
import { MODULES, V } from "./_core/registry.gen.js";
import { send, body, clean, sleep, fail, rid, now } from "./_core/util.js";

const E = process.env;
const store = makeStore(E);
const auth = makeAuth(E);
const ACC = "studio/account.json", INBOX = "studio/inbox.json";
const THEMES = ["auto", "light", "dark"], ICONS = ["sig", "quiet"], WALLS = ["mist", "dusk", "grid", "dune", "slate", "dawn"];
const NST = ["open", "info", "done"];

// the notification centre: newest first, at most 200; a key keeps one open notice per subject
async function notify(n) {
  const item = { id: rid("n_"), at: now(), mod: clean(n.mod, 24) || "studio", k: clean(n.k, 24) || "note", t: clean(n.t, 90), x: clean(n.x, 240), st: NST.includes(n.st) ? n.st : "info",
    ...(n.key ? { key: clean(n.key, 60) } : {}), ...(n.go && n.go.app ? { go: { app: clean(n.go.app, 24) } } : {}) };
  await store.mutate(INBOX, () => ({ v: 1, items: [] }), d => {
    if (item.key && d.items.some(x => x.key === item.key && x.st !== "done")) return false;
    d.items.unshift(item); d.items = d.items.slice(0, 200);
  }, "Notice · " + item.t, "Studio");
  return item;
}
let REG = null;
const reg = () => REG || (REG = makeRegistry(MODULES, { store, send, notify }));

// the look and display a person chose, kept to known values
function cleanLook(x, cur) {
  const o = { ...(cur || {}) }; x = x || {};
  if (THEMES.includes(x.theme)) o.theme = x.theme;
  if (x.accent !== undefined) o.accent = /^#[0-9a-f]{6}$/i.test(String(x.accent)) ? String(x.accent).toLowerCase() : "";
  if (ICONS.includes(x.icons)) o.icons = x.icons;
  if (x.wall !== undefined) {
    const w = x.wall;
    o.wall = !w ? null : w.kind === "daily" ? { kind: "daily" } : WALLS.includes(w.v) ? { kind: "preset", v: w.v } : (o.wall || null);
    if (o.wall) o.wall.dim = Math.max(0, Math.min(80, Math.round((+w.dim || 0) / 5) * 5));
  }
  if (x.glass !== undefined) o.glass = [0, 1, 2].includes(+x.glass) ? +x.glass : 1;
  return o;
}
function cleanDisplay(x, cur) {
  const o = { ...(cur || {}) }; x = x || {};
  if (["m", "l", "xl"].includes(x.fs)) o.fs = x.fs;
  if (["24", "12"].includes(String(x.tf))) o.tf = String(x.tf);
  return o;
}
const DEF_LOOK = () => ({ theme: "auto", accent: "", icons: "sig", wall: null, glass: 1 });
const meOf = a => ({ name: a.name, at: a.at, last: a.last || null, logins: a.logins || 0, look: { ...DEF_LOOK(), ...(a.look || {}) }, display: { fs: "m", tf: "24", ...(a.display || {}) }, seenAt: a.seenAt || "" });

async function setup(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  const b = body(req);
  if (auth.tooMany("setup")) return send(res, 429, { error: "Too many tries. Wait 15 minutes." });
  if (!auth.keyOk(b.key)) { auth.miss("setup"); await sleep(900); return send(res, 401, { error: "That studio key is not right." }); }
  const name = clean(b.name, 50), bad = auth.weak(b.pass);
  if (name.length < 2) return send(res, 400, { error: "Type your name." });
  if (bad) return send(res, 400, { error: bad });
  auth.clear("setup");
  let first = false;
  const a = await store.mutate(ACC, () => { first = true; return { v: 1, at: now(), pv: 0 }; }, d => {
    d.name = name; d.ph = auth.seal(b.pass); d.pv = (d.pv || 0) + 1; d.set = now();
  }, d => (d.pv === 1 ? "Studio set up" : "Passcode reset with the studio key"), name);
  if (first) await notify({ mod: "studio", k: "welcome", t: "Studio is ready", x: "Four modules wait on Home: Today, Briefs, Builds and the Library.", st: "info" });
  return send(res, 200, { token: auth.token(a), me: meOf(a) });
}

async function login(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  const b = body(req), pass = String(b.pass || "");
  if (!pass) return send(res, 400, { error: "Type your passcode." });
  if (auth.tooMany("in")) return send(res, 429, { error: "Too many tries. Wait 15 minutes, or reset your passcode with the studio key." });
  const f = await store.read(ACC), a = f && f.data;
  if (!a || !a.ph) return send(res, 409, { error: "Studio is not set up yet. Set it up with the studio key." });
  if (!auth.passOk(a, pass)) { auth.miss("in"); await sleep(900); return send(res, 401, { error: "That passcode is not right." }); }
  auth.clear("in");
  let acc = a;
  if ((a.last || "").slice(0, 10) !== now().slice(0, 10)) acc = await store.mutate(ACC, null, d => { d.last = now(); d.logins = (d.logins || 0) + 1; }, "Signed in", a.name).catch(() => a);
  return send(res, 200, { token: auth.token(acc), me: meOf(acc) });
}

async function who(req) {
  const o = auth.verify(req); if (!o) return null;
  const f = await store.read(ACC), a = f && f.data;
  if (!a || a.pv !== o.v) return null; // a new passcode, or a reset with the key, signs every other device out
  return { a, name: a.name };
}

async function boot(me) {
  const R = reg(), [I, data] = await Promise.all([store.load(INBOX, () => ({ v: 1, items: [] })), R.boot(me)]);
  const seen = me.a.seenAt || "";
  return { ok: true, v: V, me: meOf(me.a), mods: R.list(), data, inbox: { items: I.items.slice(0, 80), unread: I.items.filter(x => x.at > seen && x.st !== "done").length } };
}

async function meRoute(res, me, b) {
  let tok = null;
  if (b.pass) {
    const bad = auth.weak(b.pass.next);
    if (!auth.passOk(me.a, b.pass.now)) { await sleep(600); throw fail(401, "Your current passcode is not right."); }
    if (bad) throw fail(400, bad);
  }
  const a = await store.mutate(ACC, null, d => {
    if (b.name !== undefined) { const n = clean(b.name, 50); if (n.length < 2) throw fail(400, "Type your name."); d.name = n; }
    if (b.look) d.look = cleanLook(b.look, { ...DEF_LOOK(), ...(d.look || {}) });
    if (b.display) d.display = cleanDisplay(b.display, d.display);
    if (b.pass) { d.ph = auth.seal(b.pass.next); d.pv = (d.pv || 0) + 1; }
  }, b.pass ? "Passcode changed" : b.look ? "Appearance" : b.display ? "Display" : "Profile", me.name);
  if (b.pass) tok = auth.token(a);
  return send(res, 200, { ok: true, me: meOf(a), ...(tok ? { token: tok } : {}) });
}

async function inboxRoute(req, res, me, b) {
  if (req.method !== "POST") { const I = await store.load(INBOX, () => ({ v: 1, items: [] })); return send(res, 200, { ok: true, items: I.items.slice(0, 80) }); }
  if (b.op === "seen") { const a = await store.mutate(ACC, null, d => { d.seenAt = now(); }, "Notifications seen", me.name); return send(res, 200, { ok: true, seenAt: a.seenAt }); }
  if (b.op === "done") {
    let hit = null;
    const I = await store.mutate(INBOX, () => ({ v: 1, items: [] }), d => { hit = d.items.find(x => x.id === b.id); if (!hit || hit.st === "done") return false; hit.st = "done"; hit.done = now(); }, "Notice resolved", me.name);
    if (!hit) throw fail(404, "That notice was not found.");
    return send(res, 200, { ok: true, items: I.items.slice(0, 80) });
  }
  throw fail(400, "Unknown action.");
}

export default function handler(req, res) { return store.run(() => handle(req, res)); }
async function handle(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  const q = req.query || {}, a = String(q.a || "");
  try {
    if (a === "ping") {
      let open = null; if (store.ready()) { try { const f = await store.read(ACC); open = !(f && f.data && f.data.ph); } catch (_) {} }
      return send(res, 200, { ok: true, app: "loop-studio", v: V, setup: open, signin: auth.ready(), cloud: store.ready() });
    }
    if (!store.ready() || !auth.ready()) return send(res, 500, { error: "Studio is not set up yet. In Vercel, set LOOP_GITHUB_TOKEN, LOOP_DATA_REPO and STUDIO_KEY (16 characters or more)." });
    if (a === "setup") return await setup(req, res);
    if (a === "login") return await login(req, res);
    const me = await who(req);
    if (!me) return send(res, 401, { error: "Please sign in again." });
    const b = req.method === "POST" ? body(req) : {};
    if (a === "boot") return send(res, 200, await boot(me));
    if (a === "me") return await meRoute(res, me, b);
    if (a === "inbox") return await inboxRoute(req, res, me, b);
    const r = reg().routes[a];
    if (r) return await r.fn(req, res, { name: me.name, at: me.a.at }, b, q);
    return send(res, 400, { error: "Unknown action." });
  } catch (e) {
    if (!e || !e.http) console.error("studio error:", e && e.stack || e);
    return send(res, e && e.http ? e.http : 500, { error: (e && e.http && e.message) || "Something went wrong. Try again." });
  }
}
