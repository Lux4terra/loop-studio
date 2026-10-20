/* Loop Studio · module today · built from modules/today/screen.js */
/* Today · screen (slot). Loaded when the app opens; draws through the shell's helpers only. */
Studio.register("today", {
  async load(ctx) { const r = await ctx.api(); return r.ok ? r.j.today : null; },
  render(ctx, rec) {
    const n = rec && rec.queue ? rec.queue.length : 0;
    return ctx.ui.slot(ctx, {
      icon: "sun",
      title: rec && rec.focus ? rec.focus : ctx.t("No focus set yet"),
      line: n ? n + " " + ctx.t(n === 1 ? "build in the queue" : "builds in the queue") : ctx.t("The day's one focus, the build queue, a focus timer and the morning briefing will sit here.")
    });
  }
});
