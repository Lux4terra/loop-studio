// Library · server part (slot). Its record is in place and may already hold items filed by earlier builds;
// search, filing and reuse arrive with the module's build.
export default function library(core) {
  const ITEMS = core.path("items");
  const def = () => ({ v: 1, items: [] });
  return {
    routes: {
      async library(req, res) {
        if (req.method === "POST") throw core.fail(400, "The Library opens for changes with its own build.");
        return core.send(res, 200, { ok: true, library: await core.load(ITEMS, def) });
      }
    },
    async boot() { const d = await core.load(ITEMS, def); return { count: (d.items || []).length, badge: 0 }; }
  };
}
