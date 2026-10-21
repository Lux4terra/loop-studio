/* Loop Studio · module today · built from modules/today/screen.js */
/* Today · screen. The morning briefing, written here from the day's figures in the reader's language; the focus, set in
   a tap; a focus timer that runs on this device and survives a reload; and the queue, ordered by dragging or nudging.
   Draws through the shell's helpers only; every word a person reads passes through ctx.t. */
(function () {
  const KIND_L = { brief: "Brief", build: "Build" };
  let editing = false, showBrief = false;
  const logging = {};
  const pad = n => String(n).padStart(2, "0");
  const dayKey = t => t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate());
  const yday = k => { const t = new Date(k + "T12:00:00"); t.setDate(t.getDate() - 1); return dayKey(t); };
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return pad(Math.floor(s / 60)) + ":" + pad(s % 60); };
  const timer = ctx => ctx.kept("timer") || null; // { id, start, min, day }, kept on this device
  const put = (ctx, today) => { const R = ctx.rec; if (!R) return; R.today = today; ctx.set(R); };
  const mins = S => (S || []).reduce((a, s) => a + (+s.min || 0), 0);

  async function call(ctx, body, msg, el) {
    if (el) ctx.ui.busy(el, true);
    const r = await ctx.api(body);
    if (el && el.isConnected) ctx.ui.busy(el, false);
    if (!r.ok) { ctx.toast(ctx.t((r.j && r.j.error) || "Something went wrong. Try again.")); return null; }
    if (r.j.today) put(ctx, r.j.today);
    if (msg) r.j.undo ? ctx.undo(msg, () => undo(ctx, r.j.undo)) : ctx.toast(msg);
    return r.j;
  }
  async function undo(ctx, u) { const r = await ctx.api(u); if (r.ok) { put(ctx, r.j.today); ctx.toast(ctx.t("Undone")); } else ctx.toast(ctx.t((r.j && r.j.error) || "Something went wrong. Try again.")); }

  // ---------- the morning briefing: figures in, sentences out, on this device ----------
  function briefing(ctx, R) {
    const D = R.today.days[ctx.day] || {}, Q = R.today.queue || [], W = R.figures, n = ctx.needs, out = [];
    const titles = L => L.map(x => ctx.own(x.title)).join(", ");
    out.push(D.focus ? ctx.F("Today's focus: {f}.", { f: ctx.own(D.focus) }) : ctx.T("No focus set yet. One line sets the day."));
    if (!Q.length) out.push(ctx.T("The queue is empty."));
    else out.push(Q.length === 1 ? ctx.F("One item waits in the queue: {t}.", { t: ctx.own(Q[0].title) }) : ctx.F("{n} items wait in the queue. First: {t}.", { n: Q.length, t: ctx.own(Q[0].title) }));
    const since = yday(ctx.day), fresh = Q.slice(1).filter(x => dayKey(new Date(x.at)) >= since);
    if (fresh.length) out.push(ctx.F("New in the queue: {t}.", { t: titles(fresh.slice(0, 3)) }));
    if (W) {
      const ready = (W.next || []).filter(x => x.st === "ready");
      if (W.ready === 1 && ready[0]) out.push(ctx.F("One brief is ready to send: {t}.", { t: ctx.own(ready[0].title) }));
      else if (W.ready > 1) out.push(ctx.F("{n} briefs are ready to send.", { n: W.ready }));
      if (W.draft) out.push(W.draft === 1 ? ctx.T("One brief is in draft.") : ctx.F("{n} briefs are in draft.", { n: W.draft }));
      if (W.prd) out.push(W.prd === 1 ? ctx.T("One PRD draft waits for your review.") : ctx.F("{n} PRD drafts wait for your review.", { n: W.prd }));
    }
    if (n) out.push(n === 1 ? ctx.T("One notice needs you.") : ctx.F("{n} notices need you.", { n }));
    const Y = (R.today.days[yday(ctx.day)] || {}).sessions || [];
    if (Y.length) out.push(Y.length === 1 ? ctx.F("Yesterday: one focus session, {m} minutes.", { m: mins(Y) }) : ctx.F("Yesterday: {n} focus sessions, {m} minutes.", { n: Y.length, m: mins(Y) }));
    return out;
  }
  function briefingCard(ctx, R) {
    const D = R.today.days[ctx.day] || {}, morning = new Date().getHours() < 12, read = !!D.read, u = ctx.ui;
    const title = morning ? ctx.T("Morning briefing") : ctx.T("Today's briefing");
    if (read && !showBrief) return `<button class="card pad bcard read" data-mact="briefShow" id="briefing"><div class="bh">${u.lv("prepare")}<b>${title}</b><span class="sp"></span><span class="faint small">${ctx.T("Read")} · ${ctx.T("Show")}</span></div></button>`;
    return `<div class="card pad bcard" id="briefing"><div class="bh">${u.lv("prepare")}<b>${title}</b></div><p class="small faint bsub">${ctx.T("Written on this device from today's figures.")}</p>
      <ul class="bl">${briefing(ctx, R).map(l => `<li>${l}</li>`).join("")}</ul>${read ? `<button class="link small" data-mact="briefHide">${ctx.T("Hide")}</button>` : `<button class="link small" data-mact="briefRead">${u.ic("check", "xs")} ${ctx.T("Mark read")}</button>`}</div>`;
  }

  // ---------- focus ----------
  function focusCard(ctx, D) {
    const u = ctx.ui;
    if (D.focus && !editing) return `<button class="card pad focus" data-mact="focusEdit" id="focus"><div class="fh">${u.ic("target", "s")} ${ctx.T("Today's focus")}</div><div class="ft own">${ctx.esc(D.focus)}</div><div class="small faint">${ctx.T("Tap to change")}</div></button>`;
    return `<form class="card pad focus" data-mform="focus" id="focus"><label class="fh" for="fIn">${u.ic("target", "s")} ${ctx.T("Today's focus")}</label>
      <div class="frow"><input class="in" id="fIn" name="f" maxlength="140" value="${ctx.esc(D.focus || "")}" placeholder="${ctx.T("One line for the day")}" autocomplete="off"><button class="btn sm" type="submit">${ctx.T(D.focus ? "Save" : "Set")}</button></div></form>`;
  }

  // ---------- the focus timer ----------
  function timerCard(ctx, D) {
    const u = ctx.ui, T0 = timer(ctx), S = D.sessions || [], len = String(ctx.kept("len") || "25");
    const sum = S.length ? (S.length === 1 ? ctx.F("One session · {m} min today", { m: mins(S) }) : ctx.F("{n} sessions · {m} min today", { n: S.length, m: mins(S) })) : ctx.T("No sessions yet today");
    const headr = `<div class="tmh">${u.ic("clock", "s")}<b>${ctx.T("Focus timer")}</b><span class="sp"></span><span class="faint small" id="tmSum">${sum}</span></div>`;
    if (T0) {
      const left = T0.start + T0.min * 6e4 - Date.now(), w = Math.max(0, Math.min(100, 100 - left / (T0.min * 6e4) * 100));
      return `<div class="card pad tmr on" id="timer">${headr}<div class="tml num" id="tmLeft">${mmss(left)}</div><div class="tmb"><i id="tmBar" style="width:${w.toFixed(1)}%"></i></div>
        <p class="small faint">${ctx.F("A {m}-minute session · ends at {e}. It keeps running when Studio is closed.", { m: T0.min, e: ctx.esc(ctx.hm(new Date(T0.start + T0.min * 6e4).toISOString())) })}</p>
        <button class="btn ghost" data-mact="stop">${u.ic("stop", "s")} ${ctx.T("Stop")}</button></div>`;
    }
    return `<div class="card pad tmr" id="timer">${headr}<div class="mseg" role="group">${[["25", "25 min"], ["50", "50 min"]].map(([v, l]) => `<button type="button" data-mact="len" data-v="${v}" class="${len === v ? "on" : ""}" aria-pressed="${len === v}">${ctx.T(l)}</button>`).join("")}</div>
      <button class="btn" data-mact="start" id="tmStart">${u.ic("play", "s")} ${ctx.T("Start a focus session")}</button></div>`;
  }
  function tick(ctx) {
    const T0 = timer(ctx); if (!T0) return;
    const left = T0.start + T0.min * 6e4 - Date.now(), el = ctx.q("#tmLeft"), bar = ctx.q("#tmBar");
    if (el) el.textContent = mmss(left);
    if (bar) bar.style.width = Math.max(0, Math.min(100, 100 - left / (T0.min * 6e4) * 100)).toFixed(1) + "%";
    if (left <= 0) finish(ctx, T0);
  }
  // a finished session is logged once; offline, it waits and tries again
  async function finish(ctx, T0) {
    if (logging[T0.id] && Date.now() - logging[T0.id] < 30e3) return;
    logging[T0.id] = Date.now();
    const r = await ctx.api({ op: "session", id: T0.id, day: T0.day, start: new Date(T0.start).toISOString(), min: T0.min });
    if (r.status === 0) return;
    const cur = timer(ctx); if (cur && cur.id === T0.id) ctx.keep("timer", null);
    if (r.ok) { put(ctx, r.j.today); ctx.undo(ctx.f("Focus session logged · {m} min", { m: T0.min }), () => undo(ctx, r.j.undo)); }
    else { ctx.rerender(); ctx.toast(ctx.t((r.j && r.j.error) || "Something went wrong. Try again.")); }
  }

  // ---------- the queue ----------
  function queueCard(ctx, Q) {
    const u = ctx.ui;
    if (!Q.length) return `<div class="card" id="queue">${u.empty("layers", ctx.t("The queue is empty"), ctx.t("Briefs you send to build arrive here, in the order you set."))}</div>`;
    return `<div class="card" id="queue">${Q.map((x, i) => `<div class="row qrow" data-q="${ctx.esc(x.id)}">
      <button class="grip" type="button" aria-label="${ctx.T("Drag to reorder")}">${u.ic("grip", "s")}</button>
      <button class="m qm" data-mact="qopen" data-v="${ctx.esc(x.id)}"><div class="t own">${ctx.esc(x.title)}</div><div class="s">${ctx.T(KIND_L[x.kind] || "Brief")} · ${ctx.esc(ctx.dm(x.at))}${x.v ? " · " + ctx.F("pack v{v}", { v: x.v }) : ""}</div></button>
      <span class="nudge"><button data-mact="up" data-v="${ctx.esc(x.id)}" aria-label="${ctx.T("Move up")}"${i ? "" : " disabled"}>${u.ic("up", "s")}</button><button data-mact="down" data-v="${ctx.esc(x.id)}" aria-label="${ctx.T("Move down")}"${i < Q.length - 1 ? "" : " disabled"}>${u.ic("down", "s")}</button></span>
      <button class="qdone" data-mact="qdone" data-v="${ctx.esc(x.id)}" aria-label="${ctx.T("Take off the queue")}">${u.ic("check", "s")}</button></div>`).join("")}</div>`;
  }
  // the new order shows at once; the record follows, with an undo
  async function order(ctx, ids) {
    const R = ctx.rec, by = Object.fromEntries(R.today.queue.map(x => [x.id, x])), before = R.today.queue.slice();
    R.today.queue = ids.map(i => by[i]).filter(Boolean); ctx.set(R);
    const r = await ctx.api({ op: "order", ids });
    if (!r.ok) { R.today.queue = before; ctx.set(R); ctx.toast(ctx.t((r.j && r.j.error) || "Something went wrong. Try again.")); return; }
    put(ctx, r.j.today); ctx.undo(ctx.t("Queue ordered"), () => undo(ctx, r.j.undo));
  }
  function nudge(ctx, id, by) {
    const ids = ctx.rec.today.queue.map(x => x.id), i = ids.indexOf(id), j = i + by;
    if (i < 0 || j < 0 || j >= ids.length) return;
    ids.splice(j, 0, ids.splice(i, 1)[0]); order(ctx, ids);
  }
  // drag by the handle: rows make room as it moves; the order is sent once it lands
  function sortable(ctx) {
    const list = ctx.q("#queue"); if (!list) return;
    list.querySelectorAll(".grip").forEach(g => g.addEventListener("pointerdown", e => {
      const row = g.closest(".qrow"), rows = [...list.querySelectorAll(".qrow")], i0 = rows.indexOf(row), h = row.offsetHeight, y0 = e.clientY;
      let to = i0; e.preventDefault(); try { g.setPointerCapture(e.pointerId); } catch (_) {}
      row.classList.add("drag"); rows.forEach(r => r !== row && r.classList.add("shift"));
      const move = ev => {
        const dy = ev.clientY - y0; to = Math.max(0, Math.min(rows.length - 1, i0 + Math.round(dy / h)));
        row.style.transform = "translateY(" + dy + "px)";
        rows.forEach((r, k) => { if (r !== row) r.style.transform = k > i0 && k <= to ? "translateY(" + -h + "px)" : k < i0 && k >= to ? "translateY(" + h + "px)" : ""; });
      };
      const end = () => {
        g.removeEventListener("pointermove", move); g.removeEventListener("pointerup", end); g.removeEventListener("pointercancel", end);
        rows.forEach(r => { r.style.transform = ""; r.classList.remove("shift", "drag"); });
        if (to !== i0) { const ids = rows.map(r => r.dataset.q); ids.splice(to, 0, ids.splice(i0, 1)[0]); order(ctx, ids); }
      };
      g.addEventListener("pointermove", move); g.addEventListener("pointerup", end); g.addEventListener("pointercancel", end);
    }));
  }

  // ---------- earlier days ----------
  function earlier(ctx, R) {
    const ks = Object.keys(R.today.days).filter(k => k < ctx.day).sort().reverse();
    return ks.length ? `<div class="card">${ks.map(k => { const D = R.today.days[k], S = D.sessions || [];
      return `<div class="row"><div class="m"><div class="t${D.focus ? " own" : ""}">${D.focus ? ctx.esc(D.focus) : ctx.T("No focus set")}</div><div class="s">${ctx.esc(ctx.dm(k))}${S.length ? " · " + (S.length === 1 ? ctx.F("one session, {m} min", { m: mins(S) }) : ctx.F("{n} sessions, {m} min", { n: S.length, m: mins(S) })) : ""}</div></div></div>`; }).join("")}</div>`
      : ctx.ui.empty("clock", ctx.t("Nothing earlier yet"), ctx.t("Each day's focus and sessions are kept here."));
  }

  Studio.register("today", {
    async load(ctx) { const r = await ctx.api(); return r.ok && r.j.today && r.j.today.days ? r.j : null; },
    render(ctx, R) {
      const u = ctx.ui;
      if (!R) return u.head(ctx.t("Today")) + `<div class="sk" style="height:180px"></div>`;
      const D = R.today.days[ctx.day] || {}, Q = R.today.queue || [];
      return u.head(ctx.t("Today"), { right: `<button class="fb" data-mact="earlier" aria-label="${ctx.T("Earlier days")}">${u.ic("clock")}</button>` }) +
        `<div class="eyebrow tday">${ctx.esc(ctx.dm(ctx.day))}</div>` + briefingCard(ctx, R) + focusCard(ctx, D) + timerCard(ctx, D) +
        `<div class="sec">${ctx.T("Queue")}<span class="sp"></span><span class="faint">${Q.length || ""}</span></div>` + queueCard(ctx, Q) + u.contract(ctx);
    },
    after(ctx) {
      sortable(ctx);
      if (editing) { const i = ctx.q("#fIn"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
      if (timer(ctx)) { ctx.every(1000, () => tick(ctx)); tick(ctx); }
    },
    acts: {
      focusEdit(ctx) { editing = true; ctx.rerender(); },
      briefRead(ctx, el) { showBrief = false; call(ctx, { op: "read" }, null, el); },
      briefShow(ctx) { showBrief = true; ctx.rerender(); },
      briefHide(ctx) { showBrief = false; ctx.rerender(); },
      len(ctx, el) { ctx.keep("len", el.dataset.v); ctx.rerender(); },
      start(ctx) {
        const min = +(ctx.kept("len") || 25) === 50 ? 50 : 25;
        ctx.keep("timer", { id: "t_" + Math.random().toString(36).slice(2, 10), start: Date.now(), min, day: ctx.day }); ctx.rerender();
      },
      stop(ctx) {
        const T0 = timer(ctx); ctx.keep("timer", null); ctx.rerender();
        if (T0) ctx.undo(ctx.t("Session stopped, nothing logged"), () => { ctx.keep("timer", T0); ctx.rerender(); });
      },
      up(ctx, el) { nudge(ctx, el.dataset.v, -1); },
      down(ctx, el) { nudge(ctx, el.dataset.v, 1); },
      qopen(ctx, el) { const x = ctx.rec.today.queue.find(q => q.id === el.dataset.v); if (x && x.kind === "brief") ctx.open("briefs", x.ref); },
      qdone(ctx, el) { call(ctx, { op: "remove", id: el.dataset.v }, ctx.t("Taken off the queue")); },
      earlier(ctx) { ctx.sheet(ctx.t("Earlier days"), earlier(ctx, ctx.rec)); }
    },
    forms: {
      async focus(ctx, f, fd) {
        const text = String(fd.get("f") || "").trim(); editing = false;
        await call(ctx, { op: "focus", text }, ctx.t(text ? "Focus set" : "Focus cleared"), f.querySelector("button"));
        ctx.rerender();
      }
    }
  });
})();
