// Briefs · server part (slot). Its record is in place; writing briefs and drafting PRDs arrive with the module's build.
export default function briefs(core) {
  const LIST = core.path("briefs");
  const def = () => ({ v: 1, list: [] });
  return {
    routes: {
      async briefs(req, res) {
        if (req.method === "POST") throw core.fail(400, "Briefs opens for changes with its own build.");
        return core.send(res, 200, { ok: true, briefs: await core.load(LIST, def) });
      }
    },
    async boot() { const d = await core.load(LIST, def); return { count: (d.list || []).filter(b => b.st !== "built" && b.st !== "set-aside").length, badge: 0 }; }
  };
}
