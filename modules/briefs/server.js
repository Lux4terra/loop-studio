// Briefs · from an idea to a brief to a session pack. A brief holds its problem, its user, its proof of done (each line
// a check someone can run), its limits (each action at do, prepare or raise), the Library items it reuses, the repos a
// session needs and what to read first. States: draft → ready → sent → built, or set aside.
//   do:      saving, filling fields from notes, marking ready (once the gate passes), setting aside, exporting a pack;
//            each answers with what undoes it.
//   prepare: drafting the PRD with a free model; the draft waits on the brief until a person accepts, edits or discards it.
//   raise:   sending a brief to build; refused without a person's tap (confirm), then brief.sent tells the others.
export default function briefs(core) {
  const LIST = core.path("briefs"), PACKS = core.path("packs");
  const def = () => ({ v: 1, list: [], cfg: { ai: "auto", keepOut: [] } });
  const defP = () => ({ v: 1, by: {} });
  const LV = ["do", "prepare", "raise"], ORD = ["auto", "gemini", "groq"];
  const MAXB = 200, MAXP = 8;
  const { clean, para, fail, send, now, rid } = core;
  const okId = x => /^[\w-]{2,16}$/.test(String(x || ""));

  // ---------- shape ----------
  const items = (L, n, f) => (Array.isArray(L) ? L : []).map(f).filter(Boolean).slice(0, n);
  const line = (x, n) => { const t = clean(x && typeof x === "object" ? x.t : x, n); return t ? { id: okId(x && x.id) ? String(x.id) : rid("x", 3), t } : null; };
  const FIELDS = {
    title: v => clean(v, 90),
    notes: v => para(v, 6000), problem: v => para(v, 1500), user: v => para(v, 800), how: v => para(v, 1500), close: v => para(v, 800),
    proof: v => items(v, 20, x => line(x, 300)),
    read: v => items(v, 12, x => line(x, 200)),
    limits: v => items(v, 20, x => { const l = line(x, 160); return l && { ...l, lv: LV.includes(x && x.lv) ? x.lv : "" }; }),
    reuse: v => [...new Set(items(v, 20, x => okId(x) ? String(x) : null))],
    repos: v => items(v, 8, x => {
      const n = clean(x && x.name, 80); if (!n) return null;
      if (!/^[\w.-]+\/[\w.-]+$/.test(n)) throw fail(400, "Write each repo as owner/name.");
      return { id: okId(x.id) ? String(x.id) : rid("x", 3), name: n, access: x.access === "push" ? "push" : "read" };
    }),
    branch: v => { const b = clean(v, 60); if (b && !/^[\w./-]+$/.test(b)) throw fail(400, "A branch name holds letters, numbers, dots, dashes and slashes."); return b; },
    prd: v => v == null || v === "" ? null : { text: para(v, 9000), at: now(), via: "you" }
  };
  const slug = s => String(s || "brief").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, " ").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 40) || "brief";
  const branchOf = b => b.branch || "wip/" + slug(b.title);
  const gate = b => {
    const proof = b.proof.filter(x => x.t).length, unlevelled = b.limits.filter(x => !LV.includes(x.lv)).length, title = !!b.title;
    return { title, proof, unlevelled, actions: b.limits.length, ok: title && proof >= 1 && unlevelled === 0 };
  };
  const fresh = (title, me) => ({ id: rid("b_"), title, st: "draft", at: now(), upd: now(), by: me.name,
    notes: "", problem: "", user: "", how: "", close: "", branch: "", proof: [], read: [], limits: [], reuse: [], repos: [], prd: null, prdDraft: null, packs: [] });
  const pub = b => ({ ...b, gate: gate(b), slug: slug(b.title), branchOf: branchOf(b) });
  const find = (d, id) => { const b = d.list.find(x => x.id === id); if (!b) throw fail(404, "That brief was not found."); return b; };
  const waiting = d => d.list.filter(b => b.st === "draft" || b.st === "ready");
  const saveList = (me, fn, msg) => core.mutate(LIST, def, fn, msg, me.name);

  // ---------- filling fields from notes: headings the person wrote, read as they wrote them ----------
  const HEAD = [["title", /^title$/], ["problem", /^problem$/], ["user", /^(user|users|who)$/], ["proof", /^(proof of done|proof|done when)$/],
    ["limits", /^(limits|actions)$/], ["repos", /^(repos|repositories)$/], ["read", /^(read first|read)$/], ["how", /^how$/], ["close", /^close$/]];
  function fill(notes) {
    const out = {}; let cur = null;
    const head = w => (HEAD.find(([, rx]) => rx.test(w.trim().toLowerCase())) || [])[0];
    for (const raw of String(notes || "").split("\n")) {
      const s = raw.trim(); if (!s) continue;
      // a heading is a line of its own ("## Proof of done") or a label before a colon ("Problem: ...")
      const h0 = s.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim(), mc = h0.match(/^([A-Za-z ]{2,20}?)\s*:\s*(.*)$/);
      const k = (mc && head(mc[1])) || head(h0.replace(/[:.]$/, ""));
      if (k) { cur = k; out[cur] = out[cur] || []; if (mc && head(mc[1]) && mc[2]) out[cur].push(mc[2]); continue; }
      if (cur) out[cur].push(s);
    }
    const bullet = s => s.replace(/^([-*•]|\d+[.)])\s+/, "").trim();
    const set = {};
    for (const [k, L] of Object.entries(out)) {
      if (!L.length) continue;
      if (k === "title") set.title = bullet(L[0]);
      else if (["problem", "user", "how", "close"].includes(k)) set[k] = L.map(bullet).join(" ");
      else if (k === "proof" || k === "read") set[k] = L.map(x => ({ t: bullet(x) }));
      else if (k === "limits") set.limits = L.map(x => {
        let t = bullet(x), lv = "";
        const a = t.match(/^(do|prepare|raise)\s*[:—–-]\s*(.+)$/i), z = t.match(/^(.+?)\s*(?:[([]\s*(do|prepare|raise)\s*[)\]]|[:—–-]\s*(do|prepare|raise))\.?$/i);
        if (a) { lv = a[1].toLowerCase(); t = a[2]; } else if (z) { lv = (z[2] || z[3]).toLowerCase(); t = z[1]; }
        return { t, lv };
      });
      else if (k === "repos") set.repos = L.map(x => { const r = bullet(x).match(/[\w.-]+\/[\w.-]+/); return r ? { name: r[0], access: /push|write/i.test(x) ? "push" : "read" } : null; }).filter(Boolean);
    }
    return set;
  }

  // ---------- the PRD, drafted by a free model ----------
  const PRD_HEADS = ["Summary", "Users", "Goals", "Scope", "Out of scope", "Requirements", "Risks and open questions"];
  const SYS = "You draft product requirement documents for a small studio that builds AI-augmented products. Calm, specific, plain English. " +
    "Use only what the notes give; where something is unknown, name the decision to be made rather than inventing it. No preamble and no closing remarks. " +
    "Write these sections in this order, each heading alone on its own line with nothing else: " + PRD_HEADS.join(", ") + ". " +
    "Under each heading use short paragraphs or lines starting with '- '. At most 600 words.";
  function prdCheck(text) {
    let s = String(text || "").replace(/^```\w*\n?|```$/gm, "").trim(), found = 0;
    s = s.split("\n").map(l => {
      const k = l.replace(/^#+\s*|\*\*|__/g, "").replace(/:\s*$/, "").trim().toLowerCase();
      const h = PRD_HEADS.find(x => x.toLowerCase() === k || (x === "Risks and open questions" && /^risks/.test(k)));
      if (h) { found++; return "### " + h; }
      return l;
    }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    return found >= 4 && s.length >= 200 && s.length <= 9000 ? s : null;
  }
  const prdPrompt = b => ["Brief: " + b.title, b.problem && "Problem: " + b.problem, b.user && "User: " + b.user, b.notes && "Notes:\n" + b.notes,
    b.proof.length && "Proof of done:\n" + b.proof.map(x => "- " + x.t).join("\n"),
    b.limits.length && "Limits (what automation does, prepares or raises):\n" + b.limits.map(x => "- " + x.t + (x.lv ? " (" + x.lv + ")" : "")).join("\n")].filter(Boolean).join("\n\n");

  // ---------- the session pack, in the shape of Studio's own packs ----------
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const longDate = d => { const [y, m, dd] = String(d).split("-"); return +dd + " " + MONTHS[+m - 1] + " " + y; };
  function compose(b, lib, v, day) {
    const L = ["# " + b.title, "", "Session pack · " + longDate(day) + " · version " + v + " · from Loop Studio", "", "## Read first", ""];
    for (const r of b.read) L.push("- " + r.t);
    const reused = b.reuse.map(id => lib[id]).filter(Boolean);
    if (reused.length) { L.push("- Search the Library before building anything. This brief reuses:"); for (const i of reused) L.push("  - " + i.name + (i.kind ? " (" + i.kind + ")" : "") + (i.purpose ? ": " + i.purpose : "") + (i.example ? " · `" + i.example + "`" : "")); }
    else L.push("- Search the Library before building anything.");
    L.push("", "## Repos", "");
    if (b.repos.length) for (const r of b.repos) L.push("- `" + r.name + "`, " + (r.access === "push" ? "push access" : "read-only") + ".");
    else L.push("- The session attaches what the work needs.");
    L.push("", "## What to build", "");
    if (b.problem) L.push("**Problem.** " + b.problem, "");
    if (b.user) L.push("**User.** " + b.user, "");
    if (b.prd && b.prd.text) L.push(b.prd.text, ""); else if (b.notes) L.push(b.notes, "");
    L.push("## How", "", "- Branch `" + branchOf(b) + "`. Push to `main` only after every suite passes on the exact commit.");
    if (b.limits.length) { L.push("- Each action at its level (do: act, log it, offer undo · prepare: draft for approval · raise: stop and ask):"); for (const a of b.limits) L.push("  - " + a.t + ": " + a.lv); }
    for (const h of String(b.how || "").split("\n").map(x => x.trim()).filter(Boolean)) L.push("- " + h.replace(/^[-*•]\s+/, ""));
    L.push("- Commits end with the session's attribution lines.", "", "## Proof of done", "");
    b.proof.forEach((x, i) => L.push((i + 1) + ". " + x.t));
    L.push("", "Every suite passes.", "", "## Close", "",
      b.close || "Write `claude/" + slug(b.title) + "-round-note.md` in project knowledge: what shipped, tests, decisions, open items, and the Library items this build leaves behind. Ask only what the guide, the decisions and the round notes cannot answer.");
    return L.join("\n") + "\n";
  }
  async function libOf(b, me) {
    if (!b.reuse.length) return {};
    const L = (await core.query("library.items", { ids: b.reuse }, me)) || [];
    return Object.fromEntries(L.map(x => [x.id, x]));
  }
  // a pack for the brief as it stands: the newest version when nothing changed, a new version otherwise
  async function packFor(me, id, mark) {
    const d = await core.load(LIST, def), b0 = find(d, id);
    if (!["ready", "sent", "built"].includes(b0.st)) throw fail(400, "A brief exports its session pack once it is ready.");
    if (!gate(b0).ok) throw fail(400, "The brief's gate is not met yet.");
    const lib = await libOf(b0, me);
    let out = null;
    await core.mutate(PACKS, defP, P => {
      const V = P.by[id] = P.by[id] || [], last = V[V.length - 1];
      const text = compose(b0, lib, last ? last.v + 1 : 1, me.day);
      const same = last && compose(b0, lib, last.v, me.day).replace(/^Session pack · .*$/m, "") === last.text.replace(/^Session pack · .*$/m, "");
      if (same && !(mark && !last.sent)) { out = { ...last, same: true }; return false; }
      if (same) { last.sent = now(); out = { ...last }; return; }
      const p = { v: last ? last.v + 1 : 1, at: now(), text, ...(mark ? { sent: now() } : {}) };
      V.push(p); P.by[id] = V.slice(-MAXP); out = p;
    }, "Session pack · " + b0.title, me.name);
    if (!out.same || mark) await saveList(me, d2 => {
      const b = find(d2, id); b.packs = (b.packs || []).filter(x => x.v !== out.v).concat([{ v: out.v, at: out.at, ...(out.sent ? { sent: out.sent } : {}) }]).slice(-MAXP);
    }, "Pack version " + out.v + " · " + b0.title);
    return out;
  }

  // ---------- the route ----------
  async function route(req, res, me, b, q) {
    if (req.method !== "POST") {
      const d = await core.load(LIST, def);
      const ids = [...new Set(d.list.flatMap(x => x.reuse || []))];
      const L = ids.length ? (await core.query("library.items", { ids }, me)) || [] : [];
      return send(res, 200, { ok: true, briefs: { v: d.v, list: d.list.map(pub), cfg: d.cfg || def().cfg }, ai: core.ai ? core.ai.keys() : {}, lib: Object.fromEntries(L.map(x => [x.id, { name: x.name, kind: x.kind }])) });
    }
    const op = String(b.op || ""), id = String(b.id || "");
    if (op === "new") {
      const title = clean(b.title, 90); if (title.length < 2) throw fail(400, "Give the brief a title.");
      let made;
      await saveList(me, d => { if (d.list.length >= MAXB) throw fail(400, "Studio holds 200 briefs; set some aside first."); made = fresh(title, me); d.list.unshift(made); }, "Brief started · " + title);
      return send(res, 200, { ok: true, brief: pub(made) });
    }
    if (op === "save" || op === "fill") {
      let out, undo = {}, fell = false;
      await saveList(me, d => {
        const x = find(d, id), set = op === "fill" ? fill(x.notes) : (b.set || {});
        if (op === "fill" && !Object.keys(set).length) throw fail(400, "No headings found in the notes. Start lines with Problem:, User:, Proof of done:, Limits: or Repos:.");
        for (const [k, v] of Object.entries(set)) {
          if (!FIELDS[k]) throw fail(400, "Unknown field.");
          const val = FIELDS[k](v);
          if (k === "title" && val.length < 2) throw fail(400, "Give the brief a title.");
          undo[k] = k === "prd" ? (x.prd ? x.prd.text : null) : x[k]; x[k] = val;
        }
        if (x.st === "ready" && !gate(x).ok) { x.st = "draft"; fell = true; }
        x.upd = now(); out = x;
      }, () => (op === "fill" ? "Filled from notes · " : "Brief saved · ") + out.title, me.name);
      return send(res, 200, { ok: true, brief: pub(out), undo: { op: "save", id, set: undo }, fell });
    }
    if (op === "state") {
      const to = String(b.to || "");
      let out, prev;
      await saveList(me, d => {
        const x = find(d, id), from = x.st; prev = from;
        const OK = { draft: ["ready", "set-aside"], ready: ["draft", "set-aside"], sent: ["built", "set-aside"], built: ["sent", "set-aside"], "set-aside": ["restore"] };
        if (!(OK[from] || []).includes(to)) throw fail(400, "A brief that is " + from + " cannot become " + to + ".");
        if (to === "ready" && !gate(x).ok) throw fail(400, "Ready needs at least one check in the proof of done, and a level for every action.");
        if (to === "set-aside") { x.aside = { from, at: now() }; x.st = "set-aside"; }
        else if (to === "restore") { const back = (x.aside && x.aside.from) || "draft"; x.st = back === "ready" && !gate(x).ok ? "draft" : back; delete x.aside; }
        else { x.st = to; if (to === "built") x.built = now(); }
        x.upd = now(); out = x;
      }, () => "Brief " + (to === "set-aside" ? "set aside" : to === "restore" ? "restored" : "marked " + to) + " · " + out.title, me.name);
      const back = to === "set-aside" ? "restore" : to === "restore" ? "set-aside" : prev;
      return send(res, 200, { ok: true, brief: pub(out), undo: { op: "state", id, to: back } });
    }
    if (op === "prd") {
      if (!core.ai) throw fail(500, "Drafting is not available.");
      const d = await core.load(LIST, def), x = find(d, id), cfg = d.cfg || def().cfg;
      if ((x.notes + x.problem + x.user).trim().length < 20) throw fail(400, "Write a few lines of notes first; the draft is made from them.");
      const r = await core.ai.draft({ sys: SYS, prompt: prdPrompt(x), order: cfg.ai, names: [me.name, ...(cfg.keepOut || [])], max: 1400, check: prdCheck });
      if (!r.ok && r.missing) return send(res, 400, { error: "Drafting needs " + r.missing.join(" or ") + " in Vercel.", missing: r.missing });
      if (!r.ok) return send(res, 503, { error: "The free models are busy just now. Your notes are kept; try again in a minute.", busy: true });
      let out;
      await saveList(me, d2 => { const y = find(d2, id); y.prdDraft = { text: r.text, at: now(), via: r.via, model: r.model, removed: r.removed }; y.upd = now(); out = y; }, "PRD drafted for review · " + x.title, me.name);
      return send(res, 200, { ok: true, brief: pub(out), via: r.via, removed: r.removed });
    }
    if (op === "prd-accept" || op === "prd-discard" || op === "prd-undo") {
      let out, undo = null;
      await saveList(me, d => {
        const x = find(d, id);
        if (op === "prd-undo") {
          const g = b.draft || {};
          x.prd = b.prd ? { text: para(b.prd, 9000), at: now(), via: "you" } : null;
          x.prdDraft = g.text ? { text: para(g.text, 9000), at: clean(g.at, 30) || now(), via: clean(g.via, 20), model: clean(g.model, 60), removed: +g.removed || 0 } : null;
        }
        else {
          if (!x.prdDraft) throw fail(400, "There is no draft waiting.");
          undo = { op: "prd-undo", id, prd: x.prd ? x.prd.text : null, draft: x.prdDraft };
          if (op === "prd-accept") x.prd = { text: para(b.text || x.prdDraft.text, 9000), at: now(), via: b.text ? "you" : x.prdDraft.via };
          x.prdDraft = null;
        }
        x.upd = now(); out = x;
      }, () => (op === "prd-accept" ? "PRD accepted · " : op === "prd-discard" ? "PRD draft discarded · " : "PRD restored · ") + out.title, me.name);
      return send(res, 200, { ok: true, brief: pub(out), undo });
    }
    if (op === "pack") { const p = await packFor(me, id, false); const d = await core.load(LIST, def); return send(res, 200, { ok: true, pack: p, brief: pub(find(d, id)) }); }
    if (op === "pack-get") {
      const P = await core.load(PACKS, defP), V = P.by[id] || [], p = b.v ? V.find(x => x.v === +b.v) : V[V.length - 1];
      if (!p) throw fail(404, "That pack was not found.");
      return send(res, 200, { ok: true, pack: p });
    }
    if (op === "send") {
      // raise: only a person's tap sends a brief to build
      if (b.confirm !== true) return send(res, 409, { error: "Sending a brief to build waits for your tap.", raise: true });
      const d0 = await core.load(LIST, def), x0 = find(d0, id);
      if (x0.st !== "ready") throw fail(400, "Only a ready brief is sent to build.");
      const p = await packFor(me, id, true);
      let out;
      await saveList(me, d => { const x = find(d, id); x.st = "sent"; x.sent = now(); x.upd = now(); out = x; }, "Sent to build · " + x0.title, me.name);
      await core.emit("brief.sent", { id, title: out.title, v: p.v, reuse: out.reuse, branch: branchOf(out), at: out.sent }, me);
      await core.notify({ k: "sent", t: "Brief sent to build", x: "It waits in Today's queue, with its session pack.", o: out.title, st: "info", go: { app: "today" } });
      return send(res, 200, { ok: true, brief: pub(out), pack: p });
    }
    if (op === "cfg") {
      let cfg, undo;
      await saveList(me, d => {
        const c = d.cfg = { ...def().cfg, ...(d.cfg || {}) }; undo = { ...c };
        if (b.ai !== undefined) { if (!ORD.includes(b.ai)) throw fail(400, "Unknown choice."); c.ai = b.ai; }
        if (b.keepOut !== undefined) c.keepOut = [...new Set(items(b.keepOut, 40, x => clean(x, 60) || null))];
        cfg = c;
      }, "Drafting settings", me.name);
      return send(res, 200, { ok: true, cfg, undo: { op: "cfg", ai: undo.ai, keepOut: undo.keepOut } });
    }
    if (op === "library") return send(res, 200, { ok: true, items: (await core.query("library.items", { q: clean(b.q, 60) }, me)) || [] });
    throw fail(400, "Unknown action.");
  }

  return {
    routes: { briefs: route },
    provide: {
      // for Today's briefing: how many wait, and which come next; figures only
      async "briefs.waiting"() {
        const d = await core.load(LIST, def), W = waiting(d);
        return { draft: W.filter(x => x.st === "draft").length, ready: W.filter(x => x.st === "ready").length, sent: d.list.filter(x => x.st === "sent").length,
          prd: d.list.filter(x => x.prdDraft).length, next: W.sort((a, c) => (a.st === "ready" ? 0 : 1) - (c.st === "ready" ? 0 : 1)).slice(0, 3).map(x => ({ id: x.id, title: x.title, st: x.st })) };
      }
    },
    async boot() { const d = await core.load(LIST, def); return { count: waiting(d).length, badge: d.list.filter(x => x.prdDraft).length }; }
  };
}
