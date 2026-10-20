// Loop Studio · the module registry. Each module is one folder in
// modules/: a contract (module.json), a server part, a screen, translations, a test and notes. The build writes
// registry.gen.js from the folders; here each module receives a core scoped to itself and returns its routes, the data
// Home shows for it, and what it does when another module raises an event. Modules speak through this registry only.
import { fail, clean, now, rid } from "./util.js";

export const CORE_ROUTES = ["ping", "setup", "login", "boot", "me", "inbox"];
export const LEVELS = ["do", "prepare", "raise"];

export function makeRegistry(list, base) {
  // list: [{ contract, server }] in the order the build wrote them
  const mods = [], routes = {}, contracts = {};
  const bus = {}; // event -> [module id]
  for (const { contract: C, server } of list) {
    if (contracts[C.id]) throw new Error("Two modules share the id " + C.id);
    contracts[C.id] = C;
    const prefix = "studio/" + C.id + "/";
    const own = p => { p = String(p || ""); if (!p.startsWith(prefix) || p.includes("..")) throw fail(500, "A module reached outside its own records."); return p; };
    // the core each module sees: its own records, notices to the person, and events for the others
    const core = {
      id: C.id, contract: C,
      path: name => prefix + String(name).replace(/[^a-z0-9_-]/gi, "") + ".json",
      load: (p, def) => base.store.load(own(p), def),
      read: p => base.store.read(own(p)),
      mutate: (p, def, fn, msg, who) => base.store.mutate(own(p), def, fn, msg, who),
      notify: n => base.notify({ ...n, mod: C.id }),
      emit: (ev, data, me) => api.emit(C.id, ev, data, me),
      send: base.send, fail, clean, now, rid
    };
    const m = server(core) || {};
    for (const r of Object.keys(m.routes || {})) {
      if (!(C.routes || []).includes(r)) throw new Error(C.id + " serves the route " + r + " without declaring it in its contract");
      if (CORE_ROUTES.includes(r) || routes[r]) throw new Error("The route " + r + " is already taken");
      routes[r] = { id: C.id, fn: m.routes[r] };
    }
    for (const ev of Object.keys(m.on || {})) {
      if (!((C.events || {}).listens || []).includes(ev)) throw new Error(C.id + " listens to " + ev + " without declaring it in its contract");
      (bus[ev] = bus[ev] || []).push(C.id);
    }
    mods.push({ C, m });
  }
  const byId = id => mods.find(x => x.C.id === id);
  const safe = async (fn, label) => { try { return await fn(); } catch (e) { console.error("module " + label, e && e.stack || e); return null; } };
  // what the screen needs to draw a module before its screen loads: the contract's public face
  const face = C => ({ id: C.id, name: C.name, icon: C.icon, hue: C.hue, order: C.order, dock: !!C.dock, summary: C.summary, version: C.version, status: C.status || "live",
    records: C.records || [], routes: C.routes || [], actions: (C.actions || []).map(a => ({ id: a.id, level: a.level, what: a.what })), window: C.window || null });
  const api = {
    routes, contracts,
    list: () => mods.map(x => face(x.C)),
    async boot(me) {
      const out = {};
      await Promise.all(mods.map(async ({ C, m }) => { out[C.id] = m.boot ? await safe(() => m.boot(me), "boot " + C.id) : null; }));
      return out;
    },
    async emit(from, ev, data, me) {
      const C = byId(from).C;
      if (!((C.events || {}).emits || []).includes(ev)) throw fail(500, from + " raised " + ev + " without declaring it in its contract");
      for (const id of bus[ev] || []) await safe(() => byId(id).m.on[ev](data, me, from), "event " + ev + " → " + id);
    }
  };
  return api;
}
