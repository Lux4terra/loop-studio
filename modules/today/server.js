// Today · server part (slot). Its record is in place; focus, queue, timer and briefing arrive with the module's build.
export default function today(core) {
  const DAY = core.path("day");
  const def = () => ({ v: 1, focus: "", queue: [] });
  return {
    routes: {
      async today(req, res) {
        if (req.method === "POST") throw core.fail(400, "Today opens for changes with its own build.");
        return core.send(res, 200, { ok: true, today: await core.load(DAY, def) });
      }
    },
    async boot() { const d = await core.load(DAY, def); return { count: (d.queue || []).length, badge: 0 }; }
  };
}
