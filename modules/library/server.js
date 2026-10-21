// Library · server part (slot). Its record is in place and may already hold items filed by earlier builds;
// search, filing and reuse arrive with the module's build. It already answers one read-only query for other modules:
// library.items, so Briefs can name the items a brief reuses without reaching into the Library's records.
export default function library(core) {
  const ITEMS = core.path("items");
  const def = () => ({ v: 1, items: [] });
  const pub = x => ({ id: x.id, kind: x.kind || "", name: x.name || "", purpose: x.purpose || "", example: x.example || "", at: x.at || "", uses: +x.uses || 0 });
  return {
    routes: {
      async library(req, res) {
        if (req.method === "POST") throw core.fail(400, "The Library opens for changes with its own build.");
        return core.send(res, 200, { ok: true, library: await core.load(ITEMS, def) });
      }
    },
    provide: {
      // { ids } for those items, { q } for a search over name, kind and purpose; newest first, at most 300
      async "library.items"(args) {
        const L = ((await core.load(ITEMS, def)).items || []).map(pub);
        const ids = Array.isArray(args.ids) ? args.ids.map(String) : null, q = String(args.q || "").trim().toLowerCase();
        return L.filter(x => (!ids || ids.includes(x.id)) && (!q || (x.name + " " + x.kind + " " + x.purpose).toLowerCase().includes(q)))
          .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 300);
      }
    },
    async boot() { const d = await core.load(ITEMS, def); return { count: (d.items || []).length, badge: 0 }; }
  };
}
