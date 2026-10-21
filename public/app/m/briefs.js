/* Loop Studio · module briefs · built from modules/briefs/screen.js */
/* Briefs · screen. The list, and one brief at a time (#/briefs/<id>): its gate, its fields, the PRD to review, and its
   session packs. Draws through the shell's helpers only; every word a person reads passes through ctx.t. */
(function () {
  const ST_L = { draft: "Draft", ready: "Ready", sent: "Sent", built: "Built", "set-aside": "Set aside" };
  const MSG_L = { ready: "Marked ready", draft: "Back to draft", built: "Marked built", sent: "Back to sent", "set-aside": "Set aside", restore: "Restored" };
  const FIELD_L = { title: "Title", notes: "Notes", problem: "Problem", user: "User", how: "How, besides the usual", close: "Close", branch: "Branch", prd: "PRD" };
  const LINE_L = { proof: "A check in the proof of done", limits: "An action and its level", repos: "A repo", read: "Something to read first" };
  const HINT_L = { notes: "Headings fill the fields: Problem:, User:, Proof of done:, Limits:, Repos:, Read first:. A level in brackets, such as (raise), sets an action's level.", how: "One line each.", close: "Leave empty for the usual round note.", branch: "Leave empty for the name made from the title." };
  const TALL = { notes: 1, problem: 1, user: 1, how: 1, close: 1, prd: 1 };
  const ORD = [["auto", "Gemini, then Groq"], ["gemini", "Gemini only"], ["groq", "Groq only"]];
  const KEY = { gemini: "GEMINI_API_KEY", groq: "GROQ_API_KEY" };
  let showClosed = false, libItems = null, libQ = "";

  const find = (R, id) => R.briefs.list.find(x => x.id === id);
  const upd = (ctx, b) => { const R = ctx.rec; if (!R) return; const L = R.briefs.list, i = L.findIndex(x => x.id === b.id); if (i < 0) L.unshift(b); else L[i] = b; ctx.set(R); };
  const chip = (ctx, st) => `<span class="bst bst-${ctx.esc(st)}">${ctx.T(ST_L[st] || st)}</span>`;
  const keysFor = R => { const o = (R.briefs.cfg || {}).ai || "auto", have = R.ai || {}, want = o === "auto" ? ["gemini", "groq"] : [o]; return { want, have: want.filter(p => have[p]), missing: want.filter(p => !have[p]) }; };

  // one call: busy while it runs, the brief updated, an undo offered for what can be undone
  async function call(ctx, body, msg, el) {
    if (el) ctx.ui.busy(el, true);
    const r = await ctx.api(body);
    if (el && el.isConnected) ctx.ui.busy(el, false);
    if (!r.ok) { ctx.toast(ctx.t((r.j && r.j.error) || "Something went wrong. Try again.")); return null; }
    if (r.j.brief) upd(ctx, r.j.brief);
    if (r.j.fell) ctx.toast(ctx.t("Back to draft: the gate needs a check in the proof of done and a level for every action."), 5000);
    else if (msg) r.j.undo ? ctx.undo(msg, () => undo(ctx, r.j.undo)) : ctx.toast(msg);
    return r.j;
  }
  async function undo(ctx, u) {
    const r = await ctx.api(u);
    if (!r.ok) { ctx.toast(ctx.t((r.j && r.j.error) || "Something went wrong. Try again.")); return; }
    if (r.j.brief) upd(ctx, r.j.brief);
    if (r.j.cfg && ctx.rec) { ctx.rec.briefs.cfg = r.j.cfg; ctx.set(ctx.rec); }
    ctx.toast(ctx.t("Undone"));
  }
  const save = (ctx, set, msg, el) => call(ctx, { op: "save", id: ctx.sub, set }, msg || ctx.t("Saved"), el);

  // ---------- the list ----------
  function row(ctx, b) {
    const g = b.gate, u = ctx.ui;
    const note = b.st === "draft" ? (g.ok ? ctx.t("Gate passed") : ctx.f("{n} of 2 gate checks", { n: (g.proof ? 1 : 0) + (g.unlevelled ? 0 : 1) })) : b.st === "sent" ? ctx.f("Session pack v{v}", { v: (b.packs || []).slice(-1).map(x => x.v)[0] || 1 }) : "";
    return `<button class="row" data-mact="open" data-v="${ctx.esc(b.id)}"><span class="lead">${u.ic(b.prdDraft ? "spark" : "brief", "s")}</span><div class="m"><div class="t own">${ctx.esc(b.title)}</div>
      <div class="s">${chip(ctx, b.st)}${note ? " · " + ctx.esc(note) : ""}${b.prdDraft ? " · " + ctx.T("A PRD draft waits for you") : ""}</div></div><span class="chev">${u.ic("chev", "s")}</span></button>`;
  }
  function list(ctx, R) {
    const u = ctx.ui, L = R.briefs.list.slice().sort((a, b) => String(b.upd).localeCompare(String(a.upd)));
    const grp = st => L.filter(b => b.st === st), closed = L.filter(b => b.st === "built" || b.st === "set-aside");
    const sec = (label, B) => B.length ? `<div class="sec">${ctx.esc(label)}<span class="sp"></span><span class="faint">${B.length}</span></div><div class="card">${B.map(b => row(ctx, b)).join("")}</div>` : "";
    const right = `<button class="fb" data-mact="cfg" aria-label="${ctx.T("Drafting settings")}">${u.ic("gear")}</button><button class="fb add" data-mact="new" aria-label="${ctx.T("New brief")}">${u.ic("plus")}</button>`;
    return u.head(ctx.t("Briefs"), { right }) +
      (L.length ? sec(ctx.t("Ready"), grp("ready")) + sec(ctx.t("In draft"), grp("draft")) + sec(ctx.t("Sent to build"), grp("sent")) +
        (closed.length ? `<button class="sec link-sec" data-mact="closed">${ctx.T(showClosed ? "Hide built and set aside" : "Built and set aside")} · ${closed.length}</button>${showClosed ? `<div class="card">${closed.map(b => row(ctx, b)).join("")}</div>` : ""}` : "")
        : `<div class="card">${u.empty("brief", ctx.t("No briefs yet"), ctx.t("Start with a title; the rest can wait."))}<div class="pad-b"><button class="btn" data-mact="new">${u.ic("plus", "s")} ${ctx.T("New brief")}</button></div></div>`) +
      u.contract(ctx);
  }

  // ---------- one brief ----------
  const txt = (ctx, s, ph) => s ? `<div class="pre own">${ctx.esc(s)}</div>` : `<div class="faint">${ctx.esc(ph)}</div>`;
  function gateCard(ctx, b) {
    const g = b.gate, u = ctx.ui, ok = x => `<span class="gk ${x ? "on" : ""}">${u.ic(x ? "check" : "dot", "s")}</span>`;
    const last = (b.packs || []).slice(-1)[0];
    let body = "";
    if (b.st === "draft") body = `<div class="gl">${ok(g.title)}${ctx.T("A title")}</div>
      <div class="gl">${ok(g.proof >= 1)}${ctx.F("At least one check in the proof of done · {n} so far", { n: g.proof })}</div>
      <div class="gl">${ok(!g.unlevelled)}${g.unlevelled ? ctx.F("A level for every action · {n} without one", { n: g.unlevelled }) : ctx.T("A level for every action")}</div>
      <button class="btn" data-mact="st" data-v="ready"${g.ok ? "" : " disabled"}>${u.ic("check", "s")} ${ctx.T("Mark ready")}</button>`;
    else if (b.st === "ready") body = `<p class="gp">${ctx.T("Ready to build. Export its session pack, then send it when you are.")}</p>
      <button class="btn" data-mact="pack" id="packBtn">${u.ic("copy", "s")} ${ctx.T("Export session pack")}</button>
      <div class="brow"><button class="btn soft" data-mact="sendAsk">${u.ic("send", "s")} ${ctx.T("Send to build")}</button><button class="btn ghost" data-mact="st" data-v="draft">${ctx.T("Back to draft")}</button></div>`;
    else if (b.st === "sent") body = `<p class="gp">${ctx.F("Sent to build on {d}, with session pack v{v}.", { d: ctx.esc(ctx.dm(b.sent)), v: last ? last.v : 1 })}</p>
      <div class="brow"><button class="btn soft" data-mact="pack">${u.ic("copy", "s")} ${ctx.T("Session pack")}</button><button class="btn ghost" data-mact="st" data-v="built">${u.ic("check", "s")} ${ctx.T("Mark built")}</button></div>`;
    else if (b.st === "built") body = `<p class="gp">${ctx.F("Built on {d}.", { d: ctx.esc(ctx.dm(b.built)) })}</p><div class="brow"><button class="btn soft" data-mact="pack">${u.ic("copy", "s")} ${ctx.T("Session pack")}</button><button class="btn ghost" data-mact="st" data-v="sent">${ctx.T("Not built yet")}</button></div>`;
    else body = `<p class="gp">${ctx.F("Set aside on {d}.", { d: ctx.esc(ctx.dm(b.aside && b.aside.at)) })}</p><button class="btn soft" data-mact="st" data-v="restore">${ctx.T("Restore")}</button>`;
    return `<div class="card pad gate" id="gate"><div class="gh">${chip(ctx, b.st)}<span class="sp"></span><span class="faint small">${ctx.T("Updated")} ${ctx.esc(ctx.ui.rel(b.upd))}</span></div>${body}</div>`;
  }
  const sec = (ctx, label, add, extra) => `<div class="sec">${ctx.esc(label)}<span class="sp"></span>${extra || ""}${add ? `<button class="link small" data-mact="${add[0]}" data-k="${add[1] || ""}">${ctx.ui.ic("plus", "xs")} ${ctx.esc(add[2])}</button>` : ""}</div>`;
  function lines(ctx, b, k, ph, num) {
    const L = b[k] || [];
    return L.length ? `<div class="card">${L.map((x, i) => `<button class="row" data-mact="line" data-k="${k}" data-i="${ctx.esc(x.id)}">${num ? `<span class="lead num">${i + 1}</span>` : ""}<div class="m"><div class="own">${ctx.esc(x.t)}</div></div></button>`).join("")}</div>`
      : `<div class="card pad faint">${ctx.esc(ph)}</div>`;
  }
  function one(ctx, R, id) {
    const u = ctx.ui, b = find(R, id);
    if (!b) return u.head(ctx.t("Briefs")) + `<div class="card">${u.empty("brief", ctx.t("That brief was not found."), "")}</div>`;
    const K = keysFor(R), lib = R.lib || {};
    const draftBtn = K.have.length ? `<button class="btn soft" data-mact="prd" id="prdBtn">${u.ic("spark", "s")} ${ctx.T(b.prd ? "Draft the PRD again" : "Draft the PRD")}</button>`
      : `<button class="btn soft need" data-mact="nokey" id="prdBtn"><span class="nl">${u.ic("lock", "s")} ${ctx.T("Draft the PRD")}</span><span class="nk">${ctx.F("needs {k} in Vercel", { k: `<span class="mono">${K.missing.map(p => KEY[p]).join(" or ")}</span>` })}</span></button>`;
    const keyLine = K.have.length && K.missing.length ? `<p class="small faint kl">${ctx.F("{k} is not set; drafts come from {p}.", { k: `<span class="mono">${K.missing.map(p => KEY[p]).join(", ")}</span>`, p: K.have.map(p => p === "gemini" ? "Gemini" : "Groq").join(", ") })}</p>` : "";
    const levels = x => `<div class="lvs" role="group">${["do", "prepare", "raise"].map(l => `<button class="lvb${x.lv === l ? " on lv-" + l : ""}" data-mact="lv" data-i="${ctx.esc(x.id)}" data-v="${l}" aria-pressed="${x.lv === l}">${ctx.T(l === "do" ? "Do" : l === "prepare" ? "Prepare" : "Raise")}</button>`).join("")}</div>`;
    const limits = b.limits.length ? `<div class="card">${b.limits.map(x => `<div class="row lrow${x.lv ? "" : " need"}"><button class="m own lt-t" data-mact="line" data-k="limits" data-i="${ctx.esc(x.id)}">${ctx.esc(x.t)}</button>${levels(x)}</div>`).join("")}</div>`
      : `<div class="card pad faint">${ctx.T("Each action the build takes, at do, prepare or raise.")}</div>`;
    const reuse = b.reuse.length ? `<div class="card pad chips">${b.reuse.map(i => `<span class="chip own">${ctx.esc((lib[i] || {}).name || i)}</span>`).join("")}</div>` : `<div class="card pad faint">${ctx.T("Search the Library before building anything.")}</div>`;
    const repos = b.repos.length ? `<div class="card">${b.repos.map(x => `<button class="row" data-mact="line" data-k="repos" data-i="${ctx.esc(x.id)}"><span class="lead">${u.ic("branch", "s")}</span><div class="m"><div class="mono">${ctx.esc(x.name)}</div><div class="s">${ctx.T(x.access === "push" ? "Push access" : "Read-only")}</div></div></button>`).join("")}</div>` : `<div class="card pad faint">${ctx.T("The repos a session attaches, with push or read access.")}</div>`;
    const prd = b.prdDraft ? `<div class="card pad prd draft" id="prdDraft"><div class="gh">${u.lv("prepare")}<span>${ctx.T("A draft for you to accept, edit or discard")}</span></div>
        <p class="small faint">${ctx.F("Drafted by {p} · {n} details kept out before sending", { p: ctx.esc(b.prdDraft.via === "groq" ? "Groq" : "Gemini"), n: +b.prdDraft.removed || 0 })}</p>
        <div class="pre prd-t mono">${ctx.esc(b.prdDraft.text)}</div>
        <div class="brow"><button class="btn" data-mact="prdAccept">${u.ic("check", "s")} ${ctx.T("Accept")}</button><button class="btn soft" data-mact="prdEdit">${u.ic("edit", "s")} ${ctx.T("Edit")}</button><button class="btn ghost" data-mact="prdDiscard">${ctx.T("Discard")}</button></div></div>`
      : b.prd ? `<button class="card pad prd" data-mact="field" data-k="prd"><div class="pre prd-t mono">${ctx.esc(b.prd.text)}</div></button>` : `<div class="card pad faint">${ctx.T("Drafted from your notes, then yours to accept or change.")}</div>`;
    const packs = (b.packs || []).slice().reverse();
    return u.head(b.title, { own: true, right: `<button class="fb" data-mact="field" data-k="title" aria-label="${ctx.T("Edit the title")}">${u.ic("edit")}</button>` }) + gateCard(ctx, b) +
      sec(ctx, ctx.t("Notes"), null, `<button class="link small" data-mact="field" data-k="notes">${u.ic("edit", "xs")} ${ctx.T("Edit")}</button>`) +
      `<button class="card pad tap" data-mact="field" data-k="notes">${txt(ctx, b.notes, ctx.t("Your idea, in your own words. Headings such as Problem:, User: and Proof of done: fill the fields below."))}</button>
      <div class="brow">${b.notes ? `<button class="btn ghost" data-mact="fill">${u.ic("layers", "s")} ${ctx.T("Fill fields from notes")}</button>` : ""}${draftBtn}</div>${keyLine}
      ${sec(ctx, ctx.t("Problem"))}<button class="card pad tap" data-mact="field" data-k="problem">${txt(ctx, b.problem, ctx.t("What is wrong today, and for whom."))}</button>
      ${sec(ctx, ctx.t("User"))}<button class="card pad tap" data-mact="field" data-k="user">${txt(ctx, b.user, ctx.t("Who this is for."))}</button>
      ${sec(ctx, ctx.t("Proof of done"), ["line", "proof", ctx.t("Add a check")])}${lines(ctx, b, "proof", ctx.t("Each line a check someone can run."), true)}
      ${sec(ctx, ctx.t("Limits"), ["line", "limits", ctx.t("Add an action")])}${limits}
      ${sec(ctx, ctx.t("Reuses from the Library"), ["lib", "", ctx.t("Choose")])}${reuse}
      ${sec(ctx, ctx.t("Repos"), ["line", "repos", ctx.t("Add a repo")])}${repos}
      ${sec(ctx, ctx.t("Read first"), ["line", "read", ctx.t("Add")])}${lines(ctx, b, "read", ctx.t("What the session reads before it starts."))}
      ${sec(ctx, ctx.t("PRD"))}${prd}
      ${sec(ctx, ctx.t("Session"))}<div class="card">
        <button class="row" data-mact="field" data-k="branch"><div class="m"><div class="t">${ctx.T("Branch")}</div><div class="s mono">${ctx.esc(b.branchOf)}</div></div><span class="chev">${u.ic("chev", "s")}</span></button>
        <button class="row" data-mact="field" data-k="how"><div class="m"><div class="t">${ctx.T("How, besides the usual")}</div><div class="s${b.how ? " own" : ""}">${b.how ? ctx.esc(b.how) : ctx.T("Tests, budgets, tokens: one line each.")}</div></div><span class="chev">${u.ic("chev", "s")}</span></button>
        <button class="row" data-mact="field" data-k="close"><div class="m"><div class="t">${ctx.T("Close")}</div><div class="s${b.close ? " own" : ""}">${b.close ? ctx.esc(b.close) : ctx.T("A round note in project knowledge.")}</div></div><span class="chev">${u.ic("chev", "s")}</span></button></div>
      ${packs.length ? sec(ctx, ctx.t("Session packs")) + `<div class="card">${packs.map(p => `<button class="row" data-mact="packOpen" data-v="${p.v}"><span class="lead">${u.ic("copy", "s")}</span><div class="m"><div class="t">${ctx.F("Version {v}", { v: p.v })}</div><div class="s">${ctx.esc(ctx.dm(p.at))} ${ctx.esc(ctx.hm(p.at))}${p.sent ? " · " + ctx.T("sent to build") : ""}</div></div><span class="chev">${u.ic("chev", "s")}</span></button>`).join("")}</div>` : ""}
      ${b.st !== "set-aside" ? `<button class="btn ghost aside" data-mact="st" data-v="set-aside">${u.ic("aside", "s")} ${ctx.T("Set aside")}</button>` : ""}`;
  }

  // ---------- sheets ----------
  function fieldSheet(ctx, k, val, mform) {
    const label = FIELD_L[k], v = ctx.esc(val || "");
    ctx.sheet(ctx.t(label), `<form data-mform="${mform || "field"}" data-k="${k}"><label class="f"><span>${ctx.T(label)}</span>${TALL[k] ? `<textarea class="in ta${k === "notes" || k === "prd" ? " tall" : ""}" name="v" maxlength="9000">${v}</textarea>` : `<input class="in" name="v" maxlength="90" value="${v}"${k === "title" ? " required" : ""}>`}</label>${HINT_L[k] ? `<div class="hint">${ctx.T(HINT_L[k])}</div>` : ""}<button class="btn" type="submit">${ctx.T("Save")}</button></form>`);
  }
  function lineSheet(ctx, b, k, iid) {
    const x = (b[k] || []).find(y => y.id === iid) || {}, isNew = !x.id, u = ctx.ui;
    const title = LINE_L[k];
    const lvl = x.lv || "";
    let fields = k === "repos" ? `<label class="f"><span>${ctx.T("Repo, as owner/name")}</span><input class="in mono-in" name="name" value="${ctx.esc(x.name || "")}" placeholder="owner/name" autocapitalize="off" autocorrect="off" spellcheck="false" required></label>
        <div class="f"><span>${ctx.T("Access")}</span><div class="seg" role="group">${[["push", "Push access"], ["read", "Read-only"]].map(([v, l]) => `<button type="button" data-mact="pick" data-v="${v}" class="${(x.access || "push") === v ? "on" : ""}">${ctx.T(l)}</button>`).join("")}</div><input type="hidden" name="access" value="${ctx.esc(x.access || "push")}"></div>`
      : `<label class="f"><span>${ctx.T(title)}</span><textarea class="in ta short" name="t" maxlength="300" required>${ctx.esc(x.t || "")}</textarea></label>` +
        (k === "limits" ? `<div class="f"><span>${ctx.T("Level")}</span><div class="seg" role="group">${[["do", "Do"], ["prepare", "Prepare"], ["raise", "Raise"]].map(([v, l]) => `<button type="button" data-mact="pick" data-v="${v}" class="${lvl === v ? "on" : ""}">${ctx.T(l)}</button>`).join("")}</div><input type="hidden" name="lv" value="${ctx.esc(lvl)}"><div class="hint lvh">${ctx.T("Do acts and can be undone. Prepare drafts for your approval. Raise stops and asks.")}</div></div>` : "");
    ctx.sheet(ctx.t(title), `<form data-mform="line" data-k="${k}" data-i="${ctx.esc(x.id || "")}">${fields}<button class="btn" type="submit">${ctx.T(isNew ? "Add" : "Save")}</button>${isNew ? "" : `<button type="button" class="btn ghost rm" data-mact="lineDel" data-k="${k}" data-i="${ctx.esc(x.id)}">${u.ic("close", "s")} ${ctx.T("Remove")}</button>`}</form>`);
  }
  function packSheet(ctx, b, p, copied) {
    const u = ctx.ui;
    ctx.sheet(ctx.f("Session pack · version {v}", { v: p.v }), `<p class="small pst ${copied ? "" : "faint"}" id="packSt">${copied ? u.ic("check", "xs") + " " + ctx.T("Copied. Paste it into a new session.") : ctx.T("Copy it, or share it to start a session.")}</p>
      <div class="brow"><button class="btn soft" data-mact="copy" data-v="${p.v}">${u.ic("copy", "s")} ${ctx.T("Copy")}</button><button class="btn soft" data-mact="share" data-v="${p.v}">${u.ic("share", "s")} ${ctx.T("Share")}</button></div>
      ${b.st === "ready" ? `<button class="btn send" data-mact="sendAsk">${u.ic("send", "s")} ${ctx.T("Send to build")}</button>` : ""}
      <pre class="pack mono" id="packTxt">${ctx.esc(p.text)}</pre>`);
  }
  function libSheet(ctx, b) {
    const u = ctx.ui, R = ctx.rec, cur = (find(R, b.id) || b).reuse, q = libQ.toLowerCase();
    const L = (libItems || []).filter(x => !q || (x.name + " " + x.kind + " " + x.purpose).toLowerCase().includes(q));
    const body = `<label class="f"><span>${ctx.T("Search the Library")}</span><input class="in" id="libQ" value="${ctx.esc(libQ)}" autocomplete="off"></label>
      ${libItems === null ? `<div class="sk" style="height:120px"></div>` : L.length ? `<div class="card" id="libList">${L.map(x => `<button class="row" data-mact="libPick" data-v="${ctx.esc(x.id)}" aria-pressed="${cur.includes(x.id)}"><span class="lead${cur.includes(x.id) ? " on" : ""}">${u.ic(cur.includes(x.id) ? "check" : "books", "s")}</span><div class="m"><div class="t own">${ctx.esc(x.name)}</div><div class="s own">${ctx.esc(x.kind)} · ${ctx.esc(x.purpose)}</div></div></button>`).join("")}</div>`
        : u.empty("books", ctx.t("Nothing in the Library matches."), "")}`;
    return body;
  }
  function openLib(ctx, b) {
    const draw = () => { const el = ctx.q("#libSheet"); if (el) { el.innerHTML = libSheet(ctx, b); hook(); } };
    const hook = () => { const i = ctx.q("#libQ"); if (i) i.addEventListener("input", () => { libQ = i.value; const pos = i.selectionStart; draw(); const j = ctx.q("#libQ"); if (j) { j.focus(); j.setSelectionRange(pos, pos); } }); };
    ctx.sheet(ctx.t("Reuses from the Library"), `<div id="libSheet">${libSheet(ctx, b)}</div>`, { after: hook });
    if (libItems === null) ctx.api({ op: "library" }).then(r => { libItems = r.ok ? r.j.items : []; draw(); });
    openLib.draw = draw;
  }
  function cfgSheet(ctx, R) {
    const c = R.briefs.cfg || { ai: "auto", keepOut: [] }, have = R.ai || {}, u = ctx.ui;
    ctx.sheet(ctx.t("Drafting settings"), `<form data-mform="cfg"><div class="f"><span>${ctx.T("Free models")}</span><div class="seg" role="group">${ORD.map(([v, l]) => `<button type="button" data-mact="pick" data-v="${v}" class="${c.ai === v ? "on" : ""}">${ctx.T(l)}</button>`).join("")}</div><input type="hidden" name="ai" value="${ctx.esc(c.ai)}"></div>
      <div class="card keys">${["gemini", "groq"].map(p => `<div class="row"><span class="lead">${u.ic(have[p] ? "check" : "lock", "s")}</span><div class="m"><div class="mono">${KEY[p]}</div><div class="s">${ctx.T(have[p] ? "Set in Vercel" : "Not set. Add it in Vercel, then redeploy.")}</div></div></div>`).join("")}</div>
      <label class="f" style="margin-top:16px"><span>${ctx.T("Names kept out of drafts, one per line")}</span><textarea class="in ta short" name="keepOut">${ctx.esc((c.keepOut || []).join("\n"))}</textarea></label>
      <div class="hint">${ctx.T("Your own name is always kept out, with emails, phone numbers and handles.")}</div><button class="btn" type="submit">${ctx.T("Save")}</button></form>`);
  }
  const packText = async (ctx, v) => { const r = await ctx.api({ op: "pack-get", id: ctx.sub, v }); return r.ok ? r.j.pack : null; };

  Studio.register("briefs", {
    async load(ctx) { const r = await ctx.api(); return r.ok && r.j.briefs && Array.isArray(r.j.briefs.list) ? r.j : null; },
    render(ctx, R) {
      if (!R) return ctx.ui.head(ctx.t("Briefs")) + `<div class="sk" style="height:180px"></div>`;
      return ctx.sub ? one(ctx, R, ctx.sub) : list(ctx, R);
    },
    acts: {
      new(ctx) { ctx.sheet(ctx.t("New brief"), `<form data-mform="new"><label class="f"><span>${ctx.T("Title")}</span><input class="in" name="title" maxlength="90" required></label><div class="hint">${ctx.T("A title is enough to start; the rest can wait.")}</div><button class="btn" type="submit">${ctx.T("Start the brief")}</button></form>`); },
      open(ctx, el) { ctx.go(el.dataset.v); },
      closed(ctx) { showClosed = !showClosed; ctx.rerender(); },
      cfg(ctx) { cfgSheet(ctx, ctx.rec); },
      field(ctx, el) { const b = find(ctx.rec, ctx.sub), k = el.dataset.k; fieldSheet(ctx, k, k === "prd" ? (b.prd && b.prd.text) : b[k]); },
      line(ctx, el) { lineSheet(ctx, find(ctx.rec, ctx.sub), el.dataset.k, el.dataset.i); },
      pick(ctx, el) { const g = el.parentElement; [...g.children].forEach(x => x.classList.toggle("on", x === el)); const h = g.parentElement.querySelector("input[type=hidden]"); if (h) h.value = el.dataset.v; },
      async lineDel(ctx, el) {
        const b = find(ctx.rec, ctx.sub), k = el.dataset.k;
        ctx.close(); await save(ctx, { [k]: b[k].filter(x => x.id !== el.dataset.i) }, ctx.t("Removed"));
      },
      async lv(ctx, el) {
        const b = find(ctx.rec, ctx.sub), id = el.dataset.i, v = el.dataset.v;
        await save(ctx, { limits: b.limits.map(x => x.id === id ? { ...x, lv: x.lv === v ? "" : v } : x) }, ctx.t("Level saved"));
      },
      lib(ctx) { libQ = ""; openLib(ctx, find(ctx.rec, ctx.sub)); },
      async libPick(ctx, el) {
        const b = find(ctx.rec, ctx.sub), v = el.dataset.v, on = b.reuse.includes(v), it = (libItems || []).find(x => x.id === v);
        if (it) ctx.rec.lib = { ...(ctx.rec.lib || {}), [v]: { name: it.name, kind: it.kind } };
        await save(ctx, { reuse: on ? b.reuse.filter(x => x !== v) : [...b.reuse, v] }, ctx.t(on ? "Taken off the brief" : "Added to the brief"));
        if (openLib.draw) openLib.draw();
      },
      async st(ctx, el) {
        const to = el.dataset.v;
        await call(ctx, { op: "state", id: ctx.sub, to }, ctx.t(MSG_L[to]), el);
      },
      async fill(ctx, el) { const j = await call(ctx, { op: "fill", id: ctx.sub }, null, el); if (j) ctx.undo(ctx.f("Filled {n} fields from your notes", { n: Object.keys(j.undo.set).length }), () => undo(ctx, j.undo)); },
      nokey(ctx) { const K = keysFor(ctx.rec); ctx.toast(ctx.f("Add {k} in Vercel, then redeploy. Settings in Briefs choose which model drafts.", { k: K.missing.map(p => KEY[p]).join(" or ") }), 6000); },
      async prd(ctx, el) {
        const j = await call(ctx, { op: "prd", id: ctx.sub }, null, el);
        if (j) ctx.toast(ctx.f("Draft ready. {n} details kept out before sending.", { n: +j.removed || 0 }), 4000);
      },
      async prdAccept(ctx, el) { await call(ctx, { op: "prd-accept", id: ctx.sub }, ctx.t("PRD accepted"), el); },
      async prdDiscard(ctx, el) { await call(ctx, { op: "prd-discard", id: ctx.sub }, ctx.t("Draft discarded"), el); },
      prdEdit(ctx) { const b = find(ctx.rec, ctx.sub); fieldSheet(ctx, "prd", b.prdDraft.text, "prdEdit"); },
      // one tap: the pack is made, copied while the tap still counts, and shown
      async pack(ctx, el) {
        const id = ctx.sub; ctx.ui.busy(el, true);
        const p = ctx.api({ op: "pack", id });
        const copied = ctx.copy(p.then(r => { if (!r.ok) throw new Error("no pack"); return r.j.pack.text; }));
        const r = await p; if (el.isConnected) ctx.ui.busy(el, false);
        if (!r.ok) { ctx.toast(ctx.t((r.j && r.j.error) || "Something went wrong. Try again.")); return; }
        upd(ctx, r.j.brief);
        const ok = await copied;
        packSheet(ctx, r.j.brief, r.j.pack, ok);
        ctx.toast(ok ? ctx.f("Session pack v{v} copied", { v: r.j.pack.v }) : ctx.f("Session pack v{v} ready", { v: r.j.pack.v }));
      },
      async packOpen(ctx, el) { const p = await packText(ctx, +el.dataset.v); if (p) packSheet(ctx, find(ctx.rec, ctx.sub), p, false); },
      async copy(ctx, el) { const p = await packText(ctx, +el.dataset.v), ok = p && await ctx.copy(p.text); ctx.toast(ctx.t(ok ? "Copied" : "Copying was not allowed here. Select the text and copy it.")); },
      async share(ctx, el) { const b = find(ctx.rec, ctx.sub), p = await packText(ctx, +el.dataset.v); if (p) { const ok = await ctx.share({ title: b.title, text: p.text }); if (ok) ctx.toast(ctx.t("Ready to paste")); } },
      // raise: a sheet says what sending does; only the tap inside it sends
      sendAsk(ctx) {
        const b = find(ctx.rec, ctx.sub), u = ctx.ui;
        ctx.sheet(ctx.t("Send to build"), `<div class="raise">${u.lv("raise")}<p>${ctx.F("Sending {t} marks it as sent, keeps its session pack with it, and adds it to Today's queue.", { t: ctx.own(b.title) })}</p></div>
          <button class="btn" data-mact="sendGo" id="sendGo">${u.ic("send", "s")} ${ctx.T("Send to build")}</button><button class="btn ghost" data-mact="sheetClose" style="margin-top:10px">${ctx.T("Not yet")}</button>`);
      },
      sheetClose(ctx) { ctx.close(); },
      async sendGo(ctx, el) {
        ctx.ui.busy(el, true);
        const r = await ctx.api({ op: "send", id: ctx.sub, confirm: true });
        if (!r.ok) { ctx.ui.busy(el, false); ctx.toast(ctx.t((r.j && r.j.error) || "Something went wrong. Try again.")); return; }
        ctx.close(); upd(ctx, r.j.brief);
        ctx.toast(ctx.t("Sent to build. It waits in Today's queue."), 5000);
      }
    },
    forms: {
      async new(ctx, f, fd) {
        const r = await ctx.api({ op: "new", title: fd.get("title") });
        if (!r.ok) { ctx.toast(ctx.t((r.j && r.j.error) || "Something went wrong. Try again.")); return; }
        ctx.rec.briefs.list.unshift(r.j.brief); ctx.go(r.j.brief.id);
      },
      async field(ctx, f, fd) { const k = f.dataset.k; ctx.close(); await save(ctx, { [k]: fd.get("v") }); },
      async prdEdit(ctx, f, fd) { ctx.close(); await call(ctx, { op: "prd-accept", id: ctx.sub, text: fd.get("v") }, ctx.t("PRD accepted with your edits")); },
      async line(ctx, f, fd) {
        const b = find(ctx.rec, ctx.sub), k = f.dataset.k, iid = f.dataset.i, L = (b[k] || []).slice();
        const x = k === "repos" ? { name: String(fd.get("name") || "").trim(), access: fd.get("access") } : { t: fd.get("t"), ...(k === "limits" ? { lv: fd.get("lv") } : {}) };
        const i = L.findIndex(y => y.id === iid);
        if (i >= 0) L[i] = { ...L[i], ...x }; else L.push(x);
        const j = await save(ctx, { [k]: L }, ctx.t(i >= 0 ? "Saved" : "Added"));
        if (j) ctx.close();
      },
      async cfg(ctx, f, fd) {
        const r = await ctx.api({ op: "cfg", ai: fd.get("ai"), keepOut: String(fd.get("keepOut") || "").split("\n").map(x => x.trim()).filter(Boolean) });
        if (!r.ok) { ctx.toast(ctx.t((r.j && r.j.error) || "Something went wrong. Try again.")); return; }
        ctx.close(); ctx.rec.briefs.cfg = r.j.cfg; ctx.set(ctx.rec); ctx.undo(ctx.t("Drafting settings saved"), () => undo(ctx, r.j.undo));
      }
    }
  });
})();
