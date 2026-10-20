/* Loop Studio · module briefs · built from modules/briefs/screen.js */
/* Briefs · screen (slot). Loaded when the app opens; draws through the shell's helpers only. */
Studio.register("briefs", {
  async load(ctx) { const r = await ctx.api(); return r.ok ? r.j.briefs : null; },
  render(ctx, rec) {
    const n = rec && rec.list ? rec.list.length : 0;
    return ctx.ui.slot(ctx, {
      icon: "brief",
      title: n ? n + " " + ctx.t(n === 1 ? "brief" : "briefs") : ctx.t("No briefs yet"),
      line: ctx.t("Each brief will hold its problem, its user, a proof of done that can be tested, its limits, and the Library items it reuses.")
    });
  }
});
