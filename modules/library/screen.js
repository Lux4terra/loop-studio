/* Library · screen (slot). Loaded when the app opens; draws through the shell's helpers only. */
Studio.register("library", {
  async load(ctx) { const r = await ctx.api(); return r.ok ? r.j.library : null; },
  render(ctx, rec) {
    const L = (rec && rec.items) || [], u = ctx.ui;
    const extra = L.length ? `<div class="card" style="border:0;border-top:.5px solid var(--line);border-radius:0">${L.slice(0, 12).map(x => `<div class="row"><span class="lead">${u.ic("dot", "s")}</span><div class="m"><div class="t">${u.esc(x.name)}</div><div class="s">${u.esc(ctx.t(x.kind || ""))}${x.kind ? " · " : ""}${u.esc(x.purpose || "")}</div></div></div>`).join("")}</div>` : "";
    return u.slot(ctx, {
      icon: "books",
      title: L.length ? L.length + " " + ctx.t(L.length === 1 ? "item filed" : "items filed") : ctx.t("The Library is empty"),
      line: ctx.t("Search, filing and reuse arrive with the Library's own build. Items filed before then wait here."),
      extra
    });
  }
});
