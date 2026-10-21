// Today · one focus for the day (past days kept), the queue of briefs and builds in the order the person sets, focus
// sessions logged to the day they began, and the figures the morning briefing is written from. The day is the
// person's own, as their device counts it (core passes it as me.day).
//   do:      setting the focus, ordering the queue or taking an item off it, logging a session; each answers with its undo.
//   prepare: the briefing. The server sends figures only; the screen writes the sentences in the reader's language.
// It hears brief.sent (a brief joins the queue) and asks briefs.waiting (how many briefs wait); both are declared.
export default function today(core) {
  const DAY = core.path("day");
  const def = () => ({ v: 2, days: {}, queue: [] });
  const KEEP = 400, MAXQ = 60, MAXS = 40, KINDS = ["brief", "build"];
  const { clean, fail, send, now, rid } = core;
  const okId = x => /^[\w-]{2,24}$/.test(String(x || ""));
  // the first Today kept { focus, queue } for one day; read it into days
  const up = d => {
    if (d && d.v === 2 && d.days) return d;
    const o = def(); if (d && d.focus) o.days[now().slice(0, 10)] = { focus: clean(d.focus, 140), sessions: [] };
    o.queue = ((d && d.queue) || []).filter(x => x && x.title).map(item).filter(Boolean); return o;
  };
  const day = (d, k) => (d.days[k] = d.days[k] || { focus: "", sessions: [] });
  const trim = d => { const ks = Object.keys(d.days).sort(); for (const k of ks.slice(0, Math.max(0, ks.length - KEEP))) delete d.days[k]; };
  const item = x => x && okId(x.ref) && clean(x.title, 90) ? { id: okId(x.id) ? String(x.id) : rid("q_", 3), kind: KINDS.includes(x.kind) ? x.kind : "brief", ref: String(x.ref), title: clean(x.title, 90), at: clean(x.at, 30) || now(), ...(x.v ? { v: +x.v || 1 } : {}), ...(x.branch ? { branch: clean(x.branch, 60) } : {}) } : null;
  // a day the device names, within two days of the person's today
  const near = (k, me) => /^\d{4}-\d{2}-\d{2}$/.test(String(k || "")) && Math.abs(Date.parse(k + "T12:00:00Z") - Date.parse(me.day + "T12:00:00Z")) <= 2 * 864e5 ? k : me.day;
  const recent = (d, me) => { const days = {}, from = new Date(Date.parse(me.day + "T12:00:00Z") - 31 * 864e5).toISOString().slice(0, 10); for (const [k, v] of Object.entries(d.days)) if (k >= from) days[k] = v; return { v: 2, days, queue: d.queue }; };
  const load = async () => up(await core.load(DAY, def));
  const save = (me, fn, msg) => core.mutate(DAY, def, x => { const d = up(x); delete x.focus; Object.assign(x, d); const r = fn(x); trim(x); return r; }, msg, me.name).then(up);

  async function route(req, res, me, b) {
    if (req.method !== "POST") {
      const d = await load();
      let figures = null; try { figures = await core.query("briefs.waiting", {}, me); } catch (e) { console.error("today: briefs.waiting", e && e.message); }
      return send(res, 200, { ok: true, today: recent(d, me), figures, day: me.day });
    }
    const op = String(b.op || "");
    if (op === "focus") {
      const text = clean(b.text, 140); let prev = "";
      const d = await save(me, x => { const D = day(x, me.day); prev = D.focus || ""; if (prev === text) return false; D.focus = text; D.set = now(); }, text ? "Focus · " + text : "Focus cleared");
      return send(res, 200, { ok: true, today: recent(d, me), undo: { op: "focus", text: prev } });
    }
    if (op === "order") {
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(String); let prev = [];
      const d = await save(me, x => {
        prev = x.queue.map(q => q.id);
        const by = Object.fromEntries(x.queue.map(q => [q.id, q])), next = ids.filter(i => by[i]).concat(prev.filter(i => !ids.includes(i)));
        if (next.join() === prev.join()) return false;
        x.queue = next.map(i => by[i]);
      }, "Queue ordered");
      return send(res, 200, { ok: true, today: recent(d, me), undo: { op: "order", ids: prev } });
    }
    if (op === "remove") {
      let gone = null, at = -1;
      const d = await save(me, x => { at = x.queue.findIndex(q => q.id === String(b.id)); if (at < 0) throw fail(404, "That item is no longer in the queue."); gone = x.queue.splice(at, 1)[0]; }, "Taken off the queue");
      return send(res, 200, { ok: true, today: recent(d, me), undo: { op: "restore", item: gone, at } });
    }
    if (op === "restore") {
      const it = item(b.item); if (!it) throw fail(400, "That item cannot be restored.");
      const d = await save(me, x => { if (x.queue.some(q => q.id === it.id || (q.kind === it.kind && q.ref === it.ref))) return false; x.queue.splice(Math.max(0, Math.min(+b.at || 0, x.queue.length)), 0, it); x.queue = x.queue.slice(0, MAXQ); }, "Back in the queue");
      return send(res, 200, { ok: true, today: recent(d, me) });
    }
    if (op === "session" || op === "unsession") {
      const k = near(b.day, me), id = String(b.id || "");
      if (!okId(id)) throw fail(400, "That session has no id.");
      if (op === "unsession") { const d = await save(me, x => { const D = day(x, k), n = D.sessions.length; D.sessions = D.sessions.filter(s => s.id !== id); if (D.sessions.length === n) return false; }, "Session taken off the day"); return send(res, 200, { ok: true, today: recent(d, me) }); }
      const min = +b.min, start = Date.parse(b.start || ""), end = start + min * 6e4;
      if (![25, 50].includes(min)) throw fail(400, "A focus session runs 25 or 50 minutes.");
      if (!start || end > Date.now() + 5 * 60e3) throw fail(400, "That session has not finished yet."); // a device clock a few minutes off still counts
      const d = await save(me, x => { const D = day(x, k); D.sessions = D.sessions || []; if (D.sessions.some(s => s.id === id)) return false; D.sessions.push({ id, start: new Date(start).toISOString(), end: new Date(end).toISOString(), min }); D.sessions = D.sessions.slice(-MAXS); }, "Focus session · " + min + " min");
      return send(res, 200, { ok: true, today: recent(d, me), undo: { op: "unsession", id, day: k } });
    }
    if (op === "read") {
      const d = await save(me, x => { const D = day(x, me.day); if (D.read) return false; D.read = now(); }, "Briefing read");
      return send(res, 200, { ok: true, today: recent(d, me) });
    }
    throw fail(400, "Unknown action.");
  }

  return {
    routes: { today: route },
    on: {
      // a brief sent to build joins the queue, once; sent again, it keeps its place and takes the newer pack
      async "brief.sent"(data, me) {
        const it = item({ kind: "brief", ref: data.id, title: data.title, at: data.at, v: data.v, branch: data.branch });
        if (!it) return;
        await save(me, x => {
          const cur = x.queue.find(q => q.kind === "brief" && q.ref === it.ref);
          if (cur) { cur.title = it.title; cur.v = it.v; cur.at = it.at; return; }
          x.queue.push(it); x.queue = x.queue.slice(-MAXQ);
        }, "Queue · " + it.title);
      }
    },
    async boot(me) { const d = await load(); return { count: d.queue.length, text: ((d.days[me.day] || {}).focus) || "", badge: 0 }; }
  };
}
