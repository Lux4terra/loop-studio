/* Loop Studio · the shell: sign-in, Home with its windows and apps, the notification centre, Appearance, Settings,
   and the client half of the module registry. Modules live in modules/<id>/; each screen loads only when its app opens
   and draws through Studio.register. */
"use strict";
const V = "__V__";
/* ========== basics ========== */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ST = "loop_studio";
const store = () => { try { return JSON.parse(localStorage.getItem(ST) || "{}"); } catch (_) { return {}; } };
const keep = p => { try { localStorage.setItem(ST, JSON.stringify({ ...store(), ...p })); } catch (_) {} };
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const STANDALONE = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
const G = { tok: store().tok || null, d: null, view: "", sub: "", rec: {}, offline: false, lang: store().lang || "en", ping: null, nseg: "open", ncX: {}, bip: null, loginMode: null };

/* ========== language: English keys, a small file per language, merged by the build ========== */
const LANGS = /*LANGS*/[["en", "English"]]/*/LANGS*/;
let L = {};
function t(s) { const l = G.lang; return String((l && l !== "en" && L[l] && L[l][s]) || s); }
const T = s => esc(t(s));
function langLoad(l) {
  if (!l || l === "en" || L[l] || !LANGS.some(x => x[0] === l)) return Promise.resolve();
  return fetch("i18n/" + l + ".json?v=" + V).then(r => r.ok ? r.json() : {}).then(j => { L[l] = j; }).catch(() => {});
}

/* ========== icons: 24px strokes ========== */
const P = {
  home: '<path d="M3.5 10.5 12 3.8l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-6h-5.6v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  brief: '<path d="M7 3.5h6.5l4.5 4.5v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z"/><path d="M13.5 3.5V8H18M9 12.5h6M9 16h4"/>',
  branch: '<circle cx="6.5" cy="5.5" r="2"/><circle cx="6.5" cy="18.5" r="2"/><circle cx="17.5" cy="7.5" r="2"/><path d="M6.5 7.5v9M17.5 9.5c0 4.5-6.5 3.2-10.2 7.4"/>',
  books: '<path d="M4.5 4.5h3.5v15H4.5zM10 4.5h3.5v15H10z"/><path d="M15.4 5.6l3.3-.8 3.4 14-3.3.8z"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.9 1.8-1.8 0-1.3-1.2-1.7-1.2-2.9 0-1 .8-1.8 1.8-1.8h2a3.6 3.6 0 0 0 3.6-3.6C20 6.6 16.4 3.5 12 3.5z"/><circle cx="7.8" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="7.8" r="1"/>',
  gear: '<path d="M4 8h7.8M16.2 8H20M4 16h2.8M11.2 16H20"/><circle cx="14" cy="8" r="2.2"/><circle cx="9" cy="16" r="2.2"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  back: '<path d="M14.5 6l-6 6 6 6"/>', chev: '<path d="M9.5 6l6 6-6 6"/>', close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', tick: '<path d="M6 12.5l4 4 8-9"/>', check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.2l2.5 2.5 5-5.4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  out: '<path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h9.5"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5z"/>',
  phone: '<rect x="7" y="3.5" width="10" height="17" rx="2"/><path d="M11 17.5h2"/>', download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  inbox: '<path d="M4 13.5 6.2 5.6A1.5 1.5 0 0 1 7.6 4.5h8.8a1.5 1.5 0 0 1 1.4 1.1L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><path d="M4 13.5h4.5a3.5 3.5 0 0 0 7 0H20"/>',
  layers: '<path d="M12 4 3.5 8.5 12 13l8.5-4.5z"/><path d="M3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5"/>',
  spark: '<path d="M12 3.5l1.6 5.3 5.4 1.7-5.4 1.7L12 17.5l-1.6-5.3L5 10.5l5.4-1.7z"/>', dot: '<circle cx="12" cy="12" r="2"/>',
  grip: '<path stroke-width="3" d="M9 6.5h.01M15 6.5h.01M9 12h.01M15 12h.01M9 17.5h.01M15 17.5h.01"/>', up: '<path d="M6 14.5l6-6 6 6"/>', down: '<path d="M6 9.5l6 6 6-6"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>', stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>', target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path stroke-width="3" d="M12 12h.01"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  share: '<path d="M12 3.8v11M8 7.5l4-4 4 4M7 11H6a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 18 11h-1"/>',
  send: '<path d="M4 11.5 20 4l-7.5 16-2.2-6.6zM10.3 13.4 20 4"/>', edit: '<path d="M5 19l1-4L16 5a2.1 2.1 0 0 1 3 3L9 18zM14 7l3 3"/>',
  aside: '<rect x="4" y="5" width="16" height="4" rx="1"/><path d="M5.5 9v9A1.5 1.5 0 0 0 7 19.5h10a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>'
};
const ic = (n, c = "") => `<svg class="ico ${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.dot}</svg>`;
const tile = (a, cls = "") => `<span class="ti ${cls}" style="--h:${+a.hue || 0}">${ic(a.icon)}</span>`;

/* ========== dates and words ========== */
const MN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dP = iso => { if (!iso) return null; const d = new Date(String(iso).length <= 10 ? iso + "T00:00:00" : iso); return isNaN(d) ? null : d; };
const dm = iso => { const d = dP(iso); return d ? d.getDate() + " " + t(MN[d.getMonth()]).slice(0, 3) : "—"; };
const hm = iso => { const d = dP(iso); if (!d) return ""; const H = d.getHours(), M = String(d.getMinutes()).padStart(2, "0"); return disp().tf === "12" ? ((H % 12) || 12) + ":" + M + (H < 12 ? " am" : " pm") : String(H).padStart(2, "0") + ":" + M; };
const rel = iso => { const d = dP(iso); if (!d) return ""; const m = (Date.now() - d) / 6e4; return m < 1 ? t("now") : m < 60 ? Math.round(m) + " min" : m < 60 * 20 ? hm(iso) : m < 60 * 44 ? t("yesterday") : dm(iso); };
const today = () => { const d = new Date(); return t(DN[d.getDay()]) + " " + d.getDate() + " " + t(MN[d.getMonth()]); };
const greet = () => { const h = new Date().getHours(); return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const first = n => String(n || "").trim().split(/\s+/)[0] || "";
const ini = n => String(n || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();
const plural = (n, one, many, zero) => n === 0 && zero ? t(zero) : t(n === 1 ? one : many);
const pad = n => String(n).padStart(2, "0");
const localDay = (d = new Date()) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
// templated words: f gives text, F gives HTML whose values are already HTML (numbers, or own(...) for a person's words)
const f = (s, v) => t(s).replace(/\{(\w+)\}/g, (m, k) => v && v[k] != null ? String(v[k]) : m);
const F = (s, v) => esc(t(s)).replace(/\{(\w+)\}/g, (m, k) => v && v[k] != null ? String(v[k]) : m);
const own = s => `<span class="own">${esc(s)}</span>`;

/* ========== network ========== */
async function api(a, o = {}) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), o.ms || 20000);
  try {
    const r = await fetch("/api/studio?a=" + a + (o.q || "") + "&day=" + localDay(), { method: o.body ? "POST" : "GET", cache: "no-store", signal: ctl.signal,
      headers: { ...(G.tok ? { Authorization: "Bearer " + G.tok } : {}), ...(o.body ? { "Content-Type": "application/json" } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined });
    let j = null; try { j = await r.json(); } catch (_) {}
    if (r.status === 401 && G.tok && !o.soft) signOut(t("Please sign in again."));
    // an answer cut short reads as no answer: a page never draws from half a record
    if (!j || typeof j !== "object") return { ok: false, status: 0, j: { error: t("No connection. Try again when you are back online.") } };
    return { ok: r.ok, status: r.status, j };
  } catch (_) { return { ok: false, status: 0, j: { error: t("No connection. Try again when you are back online.") } }; }
  finally { clearTimeout(tm); }
}
const errOf = r => t((r && r.j && r.j.error) || "Something went wrong. Try again.");
const cacheKey = ST + "_boot";
const cacheSave = () => { try { localStorage.setItem(cacheKey, JSON.stringify(G.d)); } catch (_) {} };
const cacheLoad = () => { try { return JSON.parse(localStorage.getItem(cacheKey) || "null"); } catch (_) { return null; } };
async function load(quiet) {
  const r = await api("boot");
  if (r.ok) {
    // a newer Studio on the server: take it once
    if (r.j.v && r.j.v !== V && V.indexOf("__") < 0 && !sessionStorage.getItem("ls_reload_" + r.j.v)) { sessionStorage.setItem("ls_reload_" + r.j.v, "1"); location.reload(); return false; }
    G.d = r.j; G.offline = false; cacheSave();
    const typing = quiet && document.activeElement && ($("main").contains(document.activeElement) || $("shB").contains(document.activeElement)) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (quiet && !typing && !sheetOn && MODS[G.view]) delete G.rec[G.view];
    if (!typing && !sheetOn) render(); else chrome();
    return true;
  }
  if (r.status === 0) { G.offline = true; if (!G.d) G.d = cacheLoad(); if (G.d) render(); else toast(errOf(r)); }
  else if (r.status !== 401) toast(errOf(r));
  return false;
}
function signOut(msg) {
  G.tok = null; G.d = null; G.rec = {}; G.view = ""; keep({ tok: null });
  try { localStorage.removeItem(cacheKey); Object.keys(localStorage).filter(k => k.startsWith(ST + "_m_")).forEach(k => localStorage.removeItem(k)); } catch (_) {}
  closeSheet("nav"); history.replaceState({ v: "", d: 0 }, "", location.pathname); render(); if (msg) toast(msg);
}

/* ========== the apps: the modules from the registry, then Appearance and Settings ========== */
const CORE = [{ id: "look", name: "Appearance", icon: "palette", hue: 330, order: 90, core: true }, { id: "settings", name: "Settings", icon: "gear", hue: 222, order: 91, core: true }];
const mods = () => (G.d && G.d.mods) || [];
const apps = () => [...mods(), ...CORE].sort((a, b) => (a.order || 0) - (b.order || 0));
const appOf = id => apps().find(a => a.id === id);
const dataOf = id => ((G.d && G.d.data) || {})[id] || {};
const look = () => ({ theme: "auto", accent: "", icons: "sig", wall: null, glass: 1, ...((G.d && G.d.me.look) || {}) });
const disp = () => ({ fs: "m", tf: "24", ...((G.d && G.d.me.display) || {}) });

/* ========== ui helpers ========== */
let toastT;
function toast(m, ms, act) {
  const e = $("toast"); e.innerHTML = esc(m) + (act ? `<button class="tact" type="button">${esc(act.label)}</button>` : ""); e.classList.toggle("act", !!act); e.classList.add("on");
  if (act) e.lastChild.onclick = () => { e.classList.remove("on"); act.fn(); };
  clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove("on"), ms || 3200);
}
function busy(b, on) { if (!b) return; if (on) { b.dataset.t = b.innerHTML; b.disabled = true; b.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>'; } else { b.disabled = false; b.innerHTML = b.dataset.t || ""; } }
const empty = (i, b, s) => `<div class="empty">${ic(i)}<b>${esc(b)}</b>${s ? `<div class="small">${esc(s)}</div>` : ""}</div>`;
const sw = (on, act, attrs = "") => `<button type="button" class="sw ${on ? "on" : ""}" data-act="${act}" role="switch" aria-checked="${!!on}" ${attrs}></button>`;
const seg = (act, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" class="${cur === v ? "on" : ""}" aria-pressed="${cur === v}">${T(l)}</button>`).join("")}</div>`;
function head(title, o = {}) {
  const back = o.back !== false && !!G.view;
  return `<h1 class="lt" id="lt">${back ? `<button class="back" data-act="back" aria-label="${T("Back")}">${ic("back")}</button>` : ""}<span${o.own ? ' class="own"' : ""}>${esc(title)}</span><span class="sp"></span>${o.right || ""}</h1>${o.lede ? `<p class="lede">${esc(o.lede)}</p>` : ""}`;
}
const LV_L = { do: "Do", prepare: "Prepare", raise: "Raise" };
const lv = l => `<span class="lv lv-${esc(l)}">${T(LV_L[l] || l)}</span>`;
/* a module's contract, at the foot of its screen: what it keeps, answers, does, tells and asks */
function contractCard(ctx) {
  const C = ctx.contract, E = C.events || {}, Q = C.queries || {}, kv = (k, v) => `<dl class="kv"><dt>${esc(k)}</dt><dd>${v}</dd></dl>`;
  const pairs = L2 => L2.filter(x => x[1].length).map(([w, xs]) => xs.map(x => `<div><span class="faint">${esc(w)}</span> <span class="mono">${esc(x)}</span></div>`).join("")).join("");
  return `<div class="sec">${T("Contract")}</div><div class="card" id="contract">${kv(t("Version"), esc(C.version) + " · " + T(C.status === "slot" ? "Slot" : "Live"))}
   ${kv(t("Records"), `<span class="mono">${C.records.map(esc).join("<br>")}</span>`)}${kv(t("Routes"), `<span class="mono">${C.routes.map(esc).join(", ")}</span>`)}
   ${kv(t("Actions"), `<div class="acts">${C.actions.map(a => `<div>${lv(a.level)}<span>${T(a.what)}</span></div>`).join("")}</div>`)}
   ${(E.emits || []).length + (E.listens || []).length ? kv(t("Events"), pairs([[t("Raises"), E.emits || []], [t("Hears"), E.listens || []]])) : ""}
   ${(Q.provides || []).length + (Q.uses || []).length ? kv(t("Queries"), pairs([[t("Answers"), Q.provides || []], [t("Asks"), Q.uses || []]])) : ""}</div>`;
}
/* an empty module screen, the same for every slot: what it will hold, and its contract */
function slotView(ctx, o = {}) {
  const C = ctx.contract;
  return head(t(C.name)) + `<div class="slot-hero">${tile(C, "sig")}<p>${T(C.summary)}</p></div>
  <div class="card">${empty(o.icon || C.icon, o.title || t("Nothing here yet"), o.line || "")}${o.extra || ""}</div>${contractCard(ctx)}`;
}
const UI = { esc, ic, head, empty, sw, seg, slot: slotView, contract: contractCard, tile, dm, hm, rel, lv, busy };

/* ========== sheets, with the browser's back ========== */
let sheetOn = false;
function hist(v, sheet, replace, sub) {
  sub = sub === undefined ? G.sub : sub;
  const d = (history.state && history.state.d) || 0, st = { v, s: sub || "", d: replace ? d : d + 1, ...(sheet ? { sheet: 1 } : {}) };
  const url = v ? "#/" + v + (sub ? "/" + sub : "") : location.pathname + location.search;
  (replace ? history.replaceState : history.pushState).call(history, st, "", url);
}
function openSheet(title, html, o = {}) {
  $("toast").classList.remove("on");
  $("shT").textContent = title; $("shB").innerHTML = html; $("shB").scrollTop = 0;
  const s = $("sheet"); s.classList.toggle("ncs", !!o.top); if (o.top) void s.offsetWidth;
  if (!sheetOn) hist(G.view, true, false);
  s.classList.add("on"); $("scrim").classList.add("on"); s.setAttribute("aria-hidden", "false"); sheetOn = true;
  if (o.after) o.after($("shB"));
}
function sheetShut() { if (!sheetOn) return; sheetOn = false; const s = $("sheet"); s.classList.remove("on"); $("scrim").classList.remove("on"); s.setAttribute("aria-hidden", "true"); }
// closing by hand also steps back over the sheet's place in history; "nav" leaves history to nav(). A navigation asked
// for before that step lands waits for it, so it is never undone by it.
let backing = null;
function closeSheet(mode) { const was = sheetOn; sheetShut(); if (mode !== "nav" && was && history.state && history.state.sheet) { backing = backing || []; history.back(); } }

/* ========== moving around: Home, then any app; Back returns the way you came ========== */
function viewOK(v) { return v === "" || !!appOf(v); }
const subOK = s => /^[\w.-]{0,40}$/.test(s || "") ? s || "" : "";
// a view is an app, and within a module, an optional sub-view of its own (a brief, say): #/briefs/b_1a2b
function nav(v, sub) {
  if (!G.d) return;
  if (backing) { backing.push([v, sub]); return; }
  if (!viewOK(v)) v = "";
  sub = v ? subOK(sub) : "";
  const fromSheet = !!(history.state && history.state.sheet);
  closeSheet("nav");
  if (v === G.view && sub === G.sub && !fromSheet) { scrollTo(0, 0); return; }
  hist(v, false, fromSheet, sub); G.view = v; G.sub = sub; render(); scrollTo(0, 0);
}
function back() {
  if (((history.state && history.state.d) || 0) > 0) return history.back();
  const v = G.sub ? G.view : ""; hist(v, false, true, ""); G.view = v; G.sub = ""; render(); scrollTo(0, 0);
}
addEventListener("popstate", e => {
  const h = location.hash.match(/^#\/([\w-]+)(?:\/([\w.-]+))?/) || [], s = e.state || { v: h[1] || "", s: h[2] || "" };
  if (sheetOn && !s.sheet) sheetShut();
  const v = viewOK(s.v || "") ? (s.v || "") : "", sub = v ? subOK(s.s) : "";
  if (v !== G.view || sub !== G.sub) { G.view = v; G.sub = sub; render(); scrollTo(0, 0); }
  if (backing) { const q = backing; backing = null; q.forEach(([v2, s2]) => nav(v2, s2)); }
});

/* ========== drawing ========== */
const VIEWS = {};
function chrome() {
  const me = G.d.me, n = (G.d.inbox || {}).unread || 0;
  $("av").textContent = ini(me.name);
  $("bellBtn").innerHTML = ic("bell") + (n ? '<i class="dot"></i>' : ""); $("bellBtn").setAttribute("aria-label", t("Notifications") + (n ? " · " + n : ""));
  const dock = [{ id: "", name: "Home", icon: "home" }, ...mods().filter(m => m.dock)];
  $("dock").innerHTML = dock.map(a => `<button data-act="open" data-v="${esc(a.id)}" class="${G.view === a.id ? "on" : ""}" aria-label="${T(a.name)}"${G.view === a.id ? ' aria-current="page"' : ""}>${ic(a.icon)}<span>${T(a.name)}</span></button>`).join("");
}
function render() {
  const inApp = !!(G.tok && G.d);
  $("login").hidden = !!G.tok; $("bar").hidden = !inApp; $("main").hidden = !G.tok; $("dock").hidden = !inApp;
  if (!G.tok) { document.body.classList.remove("home", "walldark"); renderLogin(); return; }
  if (!G.d) { $("main").innerHTML = skeleton(); return; }
  applyLook(); chrome();
  const v = G.view, A = appOf(v);
  if (TICK && TICK.id !== v) { clearInterval(TICK.h); TICK = null; }
  document.body.classList.toggle("home", !v);
  const html = !v ? homeView() : VIEWS[v] ? VIEWS[v]() : modView(v);
  $("main").innerHTML = `<div class="fade">${G.offline ? `<div class="off">${ic("clock", "s")}${T("Offline. Showing what was last loaded.")}</div>` : ""}${html}</div>`;
  $("ct").textContent = !v ? "Loop Studio" : A ? t(A.name) : "";
  watchTitle(); if (!v) winDots();
  const m = MODS[v]; if (m && m.after && (G.rec[v] != null || !m.load)) { try { m.after(ctx(v), G.rec[v]); } catch (e) { console.error(e); } }
}
let io;
function watchTitle() {
  if (io) io.disconnect(); const lt = $("lt");
  if (!lt) { $("bar").classList.add("solid"); return; }
  io = new IntersectionObserver(([e]) => $("bar").classList.toggle("solid", !e.isIntersecting), { rootMargin: "-60px 0px 0px 0px" }); io.observe(lt);
}
function skeleton() { return `<div class="sk" style="height:14px;width:40%;margin:8px 0 14px"></div><div class="sk" style="height:40px;width:70%;margin-bottom:22px"></div><div class="sk" style="height:138px;margin-bottom:22px"></div><div class="sk" style="height:220px"></div>`; }

/* ---------- Home ---------- */
function windows() {
  const W = mods().filter(m => m.window).map(m => { const d = dataOf(m.id), w = m.window, n = +d.count || 0;
    // a module may lead its window with the person's own words (Today's focus), its figure then below them
    if (d.text) return { id: m.id, a: m, v: "", l: String(d.text), own: 1, s: n ? n + " " + plural(n, w.one, w.many) : t(w.line) };
    return { id: m.id, a: m, v: n ? String(n) : "", l: plural(n, w.one, w.many, w.zero), s: t(w.line) }; });
  const I = G.d.inbox || {}, u = I.unread || 0, last = (I.items || []).find(x => x.st !== "done");
  W.push({ id: "bell", a: { hue: 4, icon: "bell", name: "Notifications" }, v: u ? String(u) : "", l: plural(u, "new notification", "new notifications", "All quiet"), s: last ? t(last.t) : t("Anything that needs you appears here first.") });
  return W;
}
function homeView() {
  const me = G.d.me, st = look().icons, W = windows();
  return `<div class="st-${st}"><div class="hello"><div class="eyebrow">${esc(today())}</div><h1 class="greet" id="lt">${T(greet())}<span>, ${esc(first(me.name))}</span></h1></div>
  <div class="wins" id="wins">${W.map(w => `<button class="win${w.v ? "" : " zero"}" ${w.id === "bell" ? 'data-act="bell"' : `data-act="open" data-v="${esc(w.id)}"`} aria-label="${T(w.a.name)}"><div class="wh">${tile(w.a)}<span>${T(w.a.name)}</span></div>${w.v ? `<div class="wv num">${esc(w.v)}</div>` : ""}<div class="wl${w.own ? " own" : ""}">${esc(w.l)}</div><div class="ws">${esc(w.s)}</div></button>`).join("")}</div>
  ${W.length > 1 ? `<div class="wdots" id="wdots">${W.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}
  <div class="sec home-sec">${T("Apps")}</div>
  <div class="apps" id="apps">${apps().map(a => { const b = +dataOf(a.id).badge || 0; return `<button class="app" data-act="open" data-v="${esc(a.id)}" data-app="${esc(a.id)}">${tile(a)}<span class="al">${T(a.name)}</span>${b ? `<span class="bd">${b > 99 ? "99+" : b}</span>` : ""}</button>`; }).join("")}</div></div>`;
}
function winDots() {
  const w = $("wins"), d = $("wdots"); if (!w || !d) return;
  w.addEventListener("scroll", () => { const i = Math.round(w.scrollLeft / Math.max(1, w.firstElementChild.offsetWidth + 12)); [...d.children].forEach((x, k) => x.classList.toggle("on", k === i)); }, { passive: true });
}

/* ---------- a module's screen: loaded when its app opens, drawn by the module ---------- */
const MODS = {};
const Studio = {
  register(id, def) {
    if (Studio._loading !== id || !mods().some(m => m.id === id)) { console.error("Studio: a screen registered as " + id + " outside its own load"); return; }
    MODS[id] = def;
  },
  version: V
};
const loading = {};
function loadScreen(id) {
  if (MODS[id]) return Promise.resolve(true);
  if (loading[id]) return loading[id];
  const m = mods().find(x => x.id === id);
  if (m && m.css && !$("css-" + id)) { const l = document.createElement("link"); l.rel = "stylesheet"; l.id = "css-" + id; l.href = "m/" + id + ".css?v=" + V; document.head.appendChild(l); }
  return loading[id] = new Promise(res => {
    const s = document.createElement("script"); s.src = "m/" + id + ".js?v=" + V; s.async = false;
    Studio._loading = id;
    s.onload = () => { Studio._loading = null; delete loading[id]; res(!!MODS[id]); };
    s.onerror = () => { Studio._loading = null; delete loading[id]; res(false); };
    if (!m) { delete loading[id]; res(false); return; }
    document.head.appendChild(s);
  });
}
/* what a module's screen may use: its own route, its record, the shell's helpers, and nothing of another module */
let TICK = null, figT;
const devKey = id => ST + "_m_" + id;
const devAll = id => { try { return JSON.parse(localStorage.getItem(devKey(id)) || "{}"); } catch (_) { return {}; } };
function devKeep(id, k, v) { const o = devAll(id); if (v == null) delete o[k]; else o[k] = v; try { localStorage.setItem(devKey(id), JSON.stringify(o)); } catch (_) {} }
async function copy(x) {
  try {
    if (typeof x !== "string" && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ "text/plain": Promise.resolve(x).then(s => new Blob([s], { type: "text/plain" })) })]); return true; }
    await navigator.clipboard.writeText(await x); return true;
  } catch (_) { try { await navigator.clipboard.writeText(await x); return true; } catch (__) { return false; } }
}
async function share(o) {
  if (navigator.share) { try { await navigator.share({ title: o.title, text: o.text }); return true; } catch (e) { if (e && e.name === "AbortError") return false; } }
  return copy(o.text);
}
// after a module saves, Home's figures follow quietly
function figuresSoon() {
  clearTimeout(figT); figT = setTimeout(async () => {
    const r = await api("boot", { soft: true }); if (!r.ok || !G.d) return;
    G.d = { ...r.j, me: G.d.me }; cacheSave(); if (!G.view) render(); else chrome();
  }, 1200);
}
function ctx(id) {
  const C = mods().find(m => m.id === id), I = (G.d && G.d.inbox) || {};
  return { id, contract: C, ui: UI, t, T, f, F, own, plural, esc, ic, toast, data: dataOf(id), lang: G.lang, day: localDay(),
    sub: G.view === id ? G.sub : "", get rec() { return G.rec[id]; }, needs: (I.items || []).filter(x => x.st === "open").length,
    api: (body, q) => api(C.routes[0], { ...(body ? { body } : {}), q: q || "" }).then(r => { if (r.ok && body) figuresSoon(); return r; }),
    set: r => { G.rec[id] = r; if (G.view === id) render(); },
    go: sub => nav(id, sub), open: (app, sub) => nav(app, sub),
    sheet: (title, html, o) => openSheet(title, html, o), close: () => closeSheet(),
    undo: (msg, fn) => toast(msg, 6000, { label: t("Undo"), fn }),
    keep: (k, v) => devKeep(id, k, v), kept: k => devAll(id)[k],
    every: (ms, fn) => { if (TICK) clearInterval(TICK.h); TICK = { id, h: setInterval(() => { if (G.view !== id) { clearInterval(TICK.h); TICK = null; } else try { fn(); } catch (e) { console.error(e); } }, ms) }; },
    q: sel => $("main").querySelector(sel) || $("shB").querySelector(sel), qa: sel => [...$("main").querySelectorAll(sel)],
    copy, share, hm, dm,
    rerender: () => { if (G.view === id) render(); } };
}
function modView(id) {
  const m = MODS[id];
  if (!m) { loadScreen(id).then(ok => { if (!ok) toast(t("This app could not open. Try again.")); if (G.view === id) render(); }); return head(t(appOf(id).name)) + `<div class="sk" style="height:180px"></div>`; }
  if (G.rec[id] === undefined && m.load) { G.rec[id] = null; m.load(ctx(id)).then(r => { G.rec[id] = r == null ? null : r; if (G.view === id) render(); }).catch(() => {}); }
  try { return m.render(ctx(id), G.rec[id]); } catch (e) { console.error(e); return head(t(appOf(id).name)) + empty("info", t("This screen could not be drawn."), ""); }
}

/* ---------- the notification centre: drops from the top, grouped by what it is about ---------- */
function ncBody() {
  const I = G.d.inbox || { items: [] }, seen = G.d.me.seenAt || "", sg = G.nseg;
  const grp = { open: I.items.filter(x => x.st === "open"), info: I.items.filter(x => x.st === "info"), done: I.items.filter(x => x.st === "done") }, list = grp[sg] || [];
  const by = {}; for (const x of list) (by[x.mod] = by[x.mod] || []).push(x);
  const stacks = Object.entries(by).sort((a, b) => b[1][0].at.localeCompare(a[1][0].at));
  const nameOf = k => (appOf(k) || { name: "Studio" }).name, appIc = k => appOf(k) || { hue: 222, icon: "spark" };
  const card = x => `<div class="ncard${x.at > seen && x.st !== "done" ? " new" : ""}" data-n="${esc(x.id)}">${x.go ? `<button class="t" data-act="ncGo" data-v="${esc(x.go.app)}" style="width:100%;text-align:left">` : '<div class="t">'}<span>${T(x.t)}</span><time>${esc(rel(x.at))}</time>${x.go ? "</button>" : "</div>"}${x.o ? `<div class="s own">${esc(x.o)}</div>` : ""}${x.x ? `<div class="s">${T(x.x)}</div>` : ""}${x.st === "open" ? `<span class="lv lv-raise ncm">${T("Needs you")}</span><button class="link ncr small" data-act="ncDone" data-v="${esc(x.id)}">${T("Mark resolved")}</button>` : ""}</div>`;
  return `<div class="ncdate">${esc(today())}</div>${seg("nSeg", [["open", "Needs you"], ["info", "Updates"], ["done", "Resolved"]].map(([k, l]) => [k, t(l) + (grp[k].length ? " · " + grp[k].length : "")]), sg)}
  ${stacks.length ? stacks.map(([k, L2]) => { const open = G.ncX[k] || L2.length < 3; return `<div class="ncg" data-mod="${esc(k)}"><div class="ncgh">${tile(appIc(k), "sig")}<b>${T(nameOf(k))}</b>${L2.length > 2 ? `<button class="link small" data-act="ncX" data-v="${esc(k)}">${T(open ? "Show less" : "Show all")} · ${L2.length}</button>` : ""}</div>${(open ? L2 : L2.slice(0, 1)).map(card).join("")}</div>`; }).join("")
  : empty("bell", t(sg === "open" ? "Nothing needs you" : sg === "done" ? "Nothing resolved yet" : "All quiet"), t(sg === "open" ? "Anything that needs you appears here first." : "Updates from every app appear here."))}`;
}
function bellOpen() {
  const I0 = (G.d.inbox || {}).items || [];
  if (!I0.some(x => x.st === G.nseg)) G.nseg = I0.some(x => x.st === "open") ? "open" : I0.some(x => x.st === "info") ? "info" : "open";
  openSheet(t("Notifications"), ncBody(), { top: true });
  const I = G.d.inbox;
  if (I && I.unread) api("inbox", { body: { op: "seen" } }).then(r => { if (r.ok) { G.d.me.seenAt = r.j.seenAt; I.unread = 0; cacheSave(); const b = $("bellBtn"); b.innerHTML = ic("bell"); b.setAttribute("aria-label", t("Notifications")); } });
}
(function () { const s = $("sheet"); let y0 = null;
  s.addEventListener("touchstart", e => { y0 = s.classList.contains("ncs") ? e.touches[0].clientY : null; }, { passive: true });
  s.addEventListener("touchend", e => { if (y0 == null) return; const dy = ((e.changedTouches[0] || {}).clientY || y0) - y0; y0 = null; if (dy < -70 && $("shB").scrollTop <= 0) closeSheet(); }, { passive: true });
})();

/* ---------- Appearance ---------- */
const WALLS = ["mist", "dawn", "dune", "grid", "slate", "dusk"], WALL_DARK = ["slate", "dusk"];
const WALL_L = { mist: "Mist", dawn: "Dawn", dune: "Dune", grid: "Grid", slate: "Slate", dusk: "Dusk" };
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const hexRGB = h => { h = String(h || "").trim(); let m = h.match(/^#([0-9a-f]{6})$/i); if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)); m = h.match(/^#([0-9a-f]{3})$/i); if (m) return [...m[1]].map(c => parseInt(c + c, 16)); m = h.match(/rgba?\(([^)]+)\)/); return m ? m[1].split(",").slice(0, 3).map(x => parseFloat(x)) : null; };
const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
const contrast = (a, b) => { const A = hexRGB(a), B = hexRGB(b); if (!A || !B) return 0; const x = lum(A), y = lum(B); return Math.round((Math.max(x, y) + .05) / (Math.min(x, y) + .05) * 10) / 10; };
const isDark = () => { const th = look().theme; return th === "dark" || (th === "auto" && matchMedia("(prefers-color-scheme: dark)").matches); };
const dayN = () => Math.floor(Date.now() / 864e5);
function wallKey() { const w = look().wall; if (!w) return null; if (w.kind === "daily") { const fit = isDark() ? WALL_DARK : WALLS.filter(k => !WALL_DARK.includes(k)); return fit[dayN() % fit.length]; } return WALLS.includes(w.v) ? w.v : null; }
function applyLook() {
  const lk = look(), dp = disp(), d = document.documentElement;
  if (lk.theme !== "auto") d.dataset.theme = lk.theme; else delete d.dataset.theme;
  if (dp.fs !== "m") d.dataset.fs = dp.fs; else delete d.dataset.fs;
  d.style.removeProperty("--accent"); d.style.removeProperty("--accent-ink");
  if (lk.accent) { d.style.setProperty("--accent", lk.accent); d.style.setProperty("--accent-ink", contrast(lk.accent, cssVar("--text")) >= contrast(lk.accent, cssVar("--bg")) ? "var(--text)" : "var(--bg)"); }
  document.body.dataset.glass = lk.glass;
  const k = wallKey(), w = $("wall");
  w.style.background = k ? `var(--wall-${k})` : ""; w.firstElementChild.style.opacity = k ? ((lk.wall && lk.wall.dim) || 0) / 100 : 0;
  document.body.classList.toggle("walldark", !!k && WALL_DARK.includes(k) && !((lk.wall && lk.wall.dim) >= 50 && !isDark()));
  keep({ theme: lk.theme, accent: lk.accent, fs: dp.fs });
}
async function lookSave(patch) {
  G.d.me.look = { ...look(), ...patch }; cacheSave(); render();
  const r = await api("me", { body: { look: patch } });
  if (r.ok) { G.d.me.look = r.j.me.look; cacheSave(); } else toast(errOf(r));
}
let dimT;
VIEWS.look = () => {
  const lk = look(), k = wallKey(), ids = mods().slice(0, 4);
  const opts = cssVar("--accent-options").split(/\s+/).filter(x => /^#[0-9a-f]{6}$/i.test(x)), surf = cssVar("--surface") || cssVar("--bg");
  const cur = lk.accent || cssVar("--accent"), cr = contrast(cur, surf);
  const mini = (st, list) => `<div class="apps st-${st}">${list.map(a => `<div class="app">${tile(a)}</div>`).join("")}</div>`;
  return head(t("Appearance")) + `<div class="lkprev"><div class="lkbg" style="background:${k ? `var(--wall-${k})` : "var(--bg)"}"></div><div class="lkin st-${lk.icons}"><div class="win"><div class="wh">${T("Builds")}</div><div class="wv num">3</div></div>${mini(lk.icons, ids)}</div></div>
  <div class="sec">${T("Theme")}</div>${seg("theme", [["auto", "Automatic"], ["light", "Light"], ["dark", "Dark"]], lk.theme)}
  <div class="sec">${T("Accent")}</div><div class="card pad"><div class="accs"><button class="def${!lk.accent ? " on" : ""}" data-act="accent" data-v="" aria-label="${T("The theme's own")}">${ic("close", "xs")}</button>${opts.map(c => `<button data-act="accent" data-v="${esc(c)}" class="${lk.accent === c.toLowerCase() ? "on" : ""}" style="background:${esc(c)}" aria-label="${esc(c)}">${contrast(c, surf) >= 3 ? ic("tick", "xs") : ""}</button>`).join("")}<label aria-label="${T("Your own colour")}"><input type="color" id="accC" value="${esc(/^#[0-9a-f]{6}$/i.test(cur) ? cur : opts[0] || "")}"></label></div>
   <p class="small ${cr >= 3 ? "muted" : "bad"}" style="margin:12px 2px 0" id="accTxt">${T(cr >= 4.5 ? "Reads clearly on this theme" : cr >= 3 ? "Reads well for icons and large text on this theme" : "Hard to read on this theme. The colours with a tick read well.")} · ${esc(String(cr))}:1</p></div>
  <div class="sec">${T("App icons")}</div><div class="lkst">${[["sig", "Signature"], ["quiet", "Quiet"]].map(([s, l]) => `<button class="lks${lk.icons === s ? " on" : ""}" data-act="icons" data-v="${s}" aria-pressed="${lk.icons === s}">${mini(s, ids.slice(0, 3))}<b>${T(l)}</b></button>`).join("")}</div>
  <div class="sec">${T("Wallpaper")}</div><div class="card pad"><div class="perm"><div class="m"><div>${T("A new one each day")}</div><div class="s">${T("From the designs made for your theme")}</div></div>${sw(lk.wall && lk.wall.kind === "daily", "wallDaily")}</div></div>
  <div class="wgrid" style="margin-top:12px"><button class="wsw${!lk.wall ? " on" : ""}" data-act="wall" data-v=""><span>${T("None")}</span></button>${WALLS.map(w => `<button class="wsw${lk.wall && lk.wall.kind === "preset" && lk.wall.v === w ? " on" : ""}" data-act="wall" data-v="${w}" style="background:var(--wall-${w})"><span>${T(WALL_L[w])}</span></button>`).join("")}</div>
  ${lk.wall ? `<div class="card pad" style="margin-top:12px"><label class="f" style="margin:0"><span>${T("Dim")} · <b id="dimV">${lk.wall.dim || 0}%</b></span><input type="range" class="rng" id="wDim" min="0" max="80" step="5" value="${lk.wall.dim || 0}"></label></div>` : ""}
  <div class="sec">${T("Windows")}</div>${seg("glass", [["0", "Solid"], ["1", "Soft"], ["2", "Clear"]], String(lk.glass))}`;
};

/* ---------- Settings ---------- */
VIEWS.settings = () => {
  const me = G.d.me, dp = disp();
  const install = STANDALONE ? `<div class="row"><span class="lead">${ic("check", "s")}</span><div class="m"><div class="t">${T("Installed on this device")}</div><div class="s">${T("Studio opens from your Home Screen.")}</div></div></div>`
    : G.bip ? `<button class="row" data-act="install"><span class="lead">${ic("download", "s")}</span><div class="m"><div class="t">${T("Install Studio")}</div><div class="s">${T("Adds Studio to this device, like an app.")}</div></div><span class="chev">${ic("chev", "s")}</span></button>`
    : `<div class="row"><span class="lead">${ic("phone", "s")}</span><div class="m"><div class="t">${T("Add to Home Screen")}</div><div class="s">${T(IOS ? "In Safari, tap Share, then Add to Home Screen." : "In your browser's menu, choose Install app or Add to Home Screen.")}</div></div></div>`;
  return head(t("Settings")) + `<div class="card">
   <button class="row" data-act="nameEdit"><span class="lead">${ic("user", "s")}</span><div class="m"><div class="t">${esc(me.name)}</div><div class="s">${T("Your name")}</div></div><span class="chev">${ic("chev", "s")}</span></button>
   <button class="row" data-act="passEdit"><span class="lead">${ic("lock", "s")}</span><div class="m"><div class="t">${T("Passcode")}</div><div class="s">${T("Changing it signs out every other device.")}</div></div><span class="chev">${ic("chev", "s")}</span></button></div>
  <div class="sec">${T("Display")}</div><div class="card pad"><div class="f"><span>${T("Text size")}</span>${seg("fs", [["m", "Standard"], ["l", "Large"], ["xl", "Larger"]], dp.fs)}</div><div class="f" style="margin:0"><span>${T("Time")}</span>${seg("tf", [["24", "24-hour"], ["12", "12-hour"]], dp.tf)}</div></div>
  <div class="sec">${T("Language")}</div>${LANGS.length > 1 ? seg("lang", LANGS, G.lang) : `<div class="card"><div class="row"><span class="lead">${ic("globe", "s")}</span><div class="m"><div class="t">English</div><div class="s">${T("More languages arrive with their translations.")}</div></div></div></div>`}
  <div class="sec">${T("This device")}</div><div class="card">${install}</div>
  <div class="sec">${T("About")}</div><div class="card"><dl class="kv"><dt>${T("Version")}</dt><dd class="mono" id="ver">${esc(V)}</dd></dl><dl class="kv"><dt>${T("Modules")}</dt><dd>${mods().map(m => T(m.name)).join(", ")}</dd></dl><dl class="kv"><dt>${T("Records")}</dt><dd>${T("Kept in Studio's private data repo. Every save is a commit.")}</dd></dl></div>
  <button class="btn ghost" style="margin-top:22px" data-act="signout">${ic("out", "s")} ${T("Sign out")}</button>`;
};
async function dispSave(patch) {
  G.d.me.display = { ...disp(), ...patch }; cacheSave(); render();
  const r = await api("me", { body: { display: patch } }); if (r.ok) { G.d.me.display = r.j.me.display; cacheSave(); } else toast(errOf(r));
}

/* ---------- sign-in: set up once with the studio key, then your passcode ---------- */
async function renderLogin() {
  const box = $("login"); $("main").hidden = true;
  if (G.ping === null) {
    box.innerHTML = `<div class="fade"><svg class="mk" aria-hidden="true"><use href="#mark"/></svg><div class="sk" style="height:40px;width:60%"></div></div>`;
    const r = await api("ping", { soft: true }); G.ping = r.ok ? r.j : { error: true };
    if (!G.tok) renderLogin(); return;
  }
  const p = G.ping, mode = G.loginMode || (p.setup ? "setup" : "login");
  const top = `<div class="fade"><svg class="mk" aria-hidden="true"><use href="#mark"/></svg><h1>Loop Studio</h1><div class="tag">${T("Minds and Circuits, harmonized.")}</div>`;
  if (p.error) { box.innerHTML = top + `<p class="muted">${T("Studio cannot be reached just now. Check your connection and try again.")}</p><button class="btn soft" data-act="retry">${T("Try again")}</button></div>`; return; }
  if (!p.cloud || !p.signin) { box.innerHTML = top + `<p class="muted">${T("Studio needs its keys before anyone can sign in. In Vercel, set LOOP_GITHUB_TOKEN, LOOP_DATA_REPO and STUDIO_KEY, then redeploy.")}</p><button class="btn soft" data-act="retry">${T("Check again")}</button></div>`; return; }
  if (mode === "setup") {
    box.innerHTML = top + `<form data-form="setup" autocomplete="on">
    <p class="muted" style="margin:-10px 0 20px">${T(p.setup ? "Set up Studio with the studio key from Vercel, then choose your passcode." : "Reset your passcode with the studio key from Vercel.")}</p>
    <label class="f"><span>${T("Studio key")}</span><input class="in" name="key" type="password" autocomplete="off" required></label>
    <label class="f"><span>${T("Your name")}</span><input class="in" name="name" autocomplete="name" maxlength="50" required></label>
    <input type="text" name="username" value="studio" autocomplete="username" hidden>
    <label class="f"><span>${T("Passcode")}</span><input class="in" name="pass" type="password" autocomplete="new-password" minlength="8" required></label>
    <label class="f"><span>${T("Passcode again")}</span><input class="in" name="pass2" type="password" autocomplete="new-password" minlength="8" required></label>
    <div class="hint">${T("At least 8 characters.")}</div><div class="err" id="lErr"></div>
    <button class="btn" type="submit">${T(p.setup ? "Set up Studio" : "Reset and sign in")}</button></form>
    ${p.setup ? "" : `<div class="foot"><button data-act="loginMode" data-v="login">${T("Back to sign in")}</button></div>`}</div>`;
    return;
  }
  box.innerHTML = top + `<form data-form="login" autocomplete="on">
   <input type="text" name="username" value="studio" autocomplete="username" hidden>
   <label class="f"><span>${T("Passcode")}</span><input class="in" name="pass" type="password" autocomplete="current-password" required></label>
   <div class="err" id="lErr"></div><button class="btn" type="submit">${T("Sign in")}</button></form>
   <div class="foot">${T("Forgot your passcode?")} <button data-act="loginMode" data-v="setup">${T("Reset it with the studio key")}</button></div></div>`;
}
async function signedIn(j) { G.tok = j.token; keep({ tok: j.token }); G.loginMode = null; G.view = ""; history.replaceState({ v: "", d: 0 }, "", location.pathname); render(); await load(); }

/* ========== actions ========== */
const ACT = {
  open(el) { const v = el.dataset.v || ""; if (v === "bell") return bellOpen(); nav(v); },
  back() { back(); }, close() { closeSheet(); },
  bell() { bellOpen(); },
  retry() { G.ping = null; renderLogin(); },
  loginMode(el) { G.loginMode = el.dataset.v; renderLogin(); },
  signout() { signOut(t("Signed out.")); },
  nSeg(el) { G.nseg = el.dataset.v; $("shB").innerHTML = ncBody(); },
  ncX(el) { const k = el.dataset.v; G.ncX[k] = !G.ncX[k]; $("shB").innerHTML = ncBody(); },
  ncGo(el) { nav(el.dataset.v); },
  async ncDone(el) { busy(el, true); const r = await api("inbox", { body: { op: "done", id: el.dataset.v } }); if (r.ok) { G.d.inbox.items = r.j.items; cacheSave(); $("shB").innerHTML = ncBody(); } else { busy(el, false); toast(errOf(r)); } },
  theme(el) { lookSave({ theme: el.dataset.v }); },
  accent(el) { lookSave({ accent: el.dataset.v }); },
  icons(el) { lookSave({ icons: el.dataset.v }); },
  glass(el) { lookSave({ glass: +el.dataset.v }); },
  wall(el) { const v = el.dataset.v, w = look().wall; lookSave({ wall: v ? { kind: "preset", v, dim: (w && w.dim) || 0 } : null }); },
  wallDaily(el) { const on = !el.classList.contains("on"), w = look().wall; lookSave({ wall: on ? { kind: "daily", dim: (w && w.dim) || 0 } : null }); },
  fs(el) { dispSave({ fs: el.dataset.v }); }, tf(el) { dispSave({ tf: el.dataset.v }); },
  lang(el) { G.lang = el.dataset.v; keep({ lang: G.lang }); langLoad(G.lang).then(render); },
  async install() { if (!G.bip) return; G.bip.prompt(); try { await G.bip.userChoice; } catch (_) {} G.bip = null; render(); },
  nameEdit() { openSheet(t("Your name"), `<form data-form="name"><label class="f"><span>${T("Name")}</span><input class="in" name="name" maxlength="50" value="${esc(G.d.me.name)}" required></label><div class="err" id="sErr"></div><button class="btn" type="submit">${T("Save")}</button></form>`); },
  passEdit() { openSheet(t("Passcode"), `<form data-form="pass" autocomplete="on"><input type="text" name="username" value="studio" autocomplete="username" hidden><label class="f"><span>${T("Current passcode")}</span><input class="in" name="now" type="password" autocomplete="current-password" required></label><label class="f"><span>${T("New passcode")}</span><input class="in" name="next" type="password" autocomplete="new-password" minlength="8" required></label><div class="hint">${T("At least 8 characters. Every other device signs out.")}</div><div class="err" id="sErr"></div><button class="btn" type="submit">${T("Change passcode")}</button></form>`); }
};
const FORM = {
  async login(f, fd) {
    const b = f.querySelector("button[type=submit]"); busy(b, true);
    const r = await api("login", { body: { pass: fd.get("pass") }, soft: true }); busy(b, false);
    if (!r.ok) { $("lErr").textContent = errOf(r); if (r.status === 409) { G.ping = null; G.loginMode = null; } return; }
    signedIn(r.j);
  },
  async setup(f, fd) {
    if (fd.get("pass") !== fd.get("pass2")) { $("lErr").textContent = t("The two passcodes differ."); return; }
    const b = f.querySelector("button[type=submit]"); busy(b, true);
    const r = await api("setup", { body: { key: fd.get("key"), name: fd.get("name"), pass: fd.get("pass") }, soft: true }); busy(b, false);
    if (!r.ok) { $("lErr").textContent = errOf(r); return; }
    G.ping = { ...G.ping, setup: false }; signedIn(r.j);
  },
  async name(f, fd) {
    const b = f.querySelector("button[type=submit]"); busy(b, true);
    const r = await api("me", { body: { name: fd.get("name") } }); busy(b, false);
    if (!r.ok) { $("sErr").textContent = errOf(r); return; }
    G.d.me = { ...G.d.me, ...r.j.me }; cacheSave(); closeSheet(); render(); toast(t("Saved"));
  },
  async pass(f, fd) {
    const b = f.querySelector("button[type=submit]"); busy(b, true);
    const r = await api("me", { body: { pass: { now: fd.get("now"), next: fd.get("next") } }, soft: true }); busy(b, false);
    if (!r.ok) { $("sErr").textContent = errOf(r); return; }
    G.tok = r.j.token; keep({ tok: G.tok }); closeSheet(); toast(t("Passcode changed. Other devices are signed out."));
  }
};
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act],[data-mact]"); if (!el) return;
  if (el.dataset.act) { const f = ACT[el.dataset.act]; if (f) { e.preventDefault(); f(el, e); } return; }
  const m = MODS[G.view], f = m && m.acts && m.acts[el.dataset.mact];
  if (f) { e.preventDefault(); f(ctx(G.view), el, e); }
});
document.addEventListener("submit", e => {
  const f = e.target.closest("form[data-form],form[data-mform]"); if (!f) return; e.preventDefault();
  if (f.dataset.form) { const h = FORM[f.dataset.form]; if (h) h(f, new FormData(f)); return; }
  const m = MODS[G.view], h = m && m.forms && m.forms[f.dataset.mform]; if (h) h(ctx(G.view), f, new FormData(f));
});
document.addEventListener("input", e => {
  if (e.target.id === "wDim") { const v = +e.target.value; $("dimV").textContent = v + "%"; $("wall").firstElementChild.style.opacity = v / 100; clearTimeout(dimT); dimT = setTimeout(() => lookSave({ wall: { ...look().wall, v: (look().wall || {}).v, dim: v } }), 400); }
});
document.addEventListener("change", e => { if (e.target.id === "accC") lookSave({ accent: e.target.value }); });
addEventListener("keydown", e => { if (e.key === "Escape" && sheetOn) closeSheet(); });
addEventListener("beforeinstallprompt", e => { e.preventDefault(); G.bip = e; if (G.view === "settings") render(); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (G.d) render(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && G.tok && G.d) load(true); });

/* ========== start ========== */
(async function start() {
  $("shX").innerHTML = ic("close");
  const hh = location.hash.match(/^#\/([\w-]+)(?:\/([\w.-]+))?/) || [], want = hh[1] || "", wantSub = hh[2] || "";
  history.replaceState({ v: "", d: 0 }, "", location.pathname + location.search);
  await langLoad(G.lang);
  if (!G.tok) { render(); }
  else {
    G.d = cacheLoad(); if (G.d) render(); else render();
    const ok = await load();
    if (ok && want && viewOK(want)) nav(want, wantSub);
  }
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
