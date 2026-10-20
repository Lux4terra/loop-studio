// Builds · server part (slot). Its record is in place; session packs and suite status arrive with the module's build.
export default function builds(core) {
  const LIST = core.path("builds");
  const def = () => ({ v: 1, list: [] });
  return {
    routes: {
      async builds(req, res) {
        if (req.method === "POST") throw core.fail(400, "Builds opens for changes with its own build.");
        return core.send(res, 200, { ok: true, builds: await core.load(LIST, def) });
      }
    },
    async boot() { const d = await core.load(LIST, def); return { count: (d.list || []).filter(b => b.st === "running").length, badge: 0 }; }
  };
}
