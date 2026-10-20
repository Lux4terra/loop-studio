/* Loop Studio · module builds · built from modules/builds/screen.js */
/* Builds · screen (slot). Loaded when the app opens; draws through the shell's helpers only. */
Studio.register("builds", {
  async load(ctx) { const r = await ctx.api(); return r.ok ? r.j.builds : null; },
  render(ctx, rec) {
    const n = rec && rec.list ? rec.list.length : 0;
    return ctx.ui.slot(ctx, {
      icon: "branch",
      title: n ? n + " " + ctx.t(n === 1 ? "build" : "builds") : ctx.t("No builds running"),
      line: ctx.t("Each build will show its repo, its branch, its session, its suite status and the next step, side by side.")
    });
  }
});
