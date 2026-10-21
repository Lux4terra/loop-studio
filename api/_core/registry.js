// Loop Studio · the module registry. Each module is one folder in
// modules/: a contract (module.json), a server part, a screen, translations, a test and notes. The build writes
// registry.gen.js from the folders; here each module receives a core scoped to itself and returns its routes, the data
// Home shows for it, what it does when another module raises an event, and the read-only queries it answers for others.
// Modules speak through this registry only: events to tell, queries to ask, both declared in the contract.
import { AsyncLocalStorage } from "node:async_hooks";
import { fail, clean, para, now, rid, copyOf } from "./util.js";

export const CORE_ROUTES = ["ping", "setup", "login", "boot", "me", "inbox"];
export const LEVELS = ["do", "prepare", "raise"];

export function makeRegistry(list, base) {
  // list: [{ contract, server }] in the order the build wrote them
  const mods = [], routes = {}, contracts = {}, provided = {};
  const bus = {}; // event -> [module id]
  const RO = new AsyncLocalStorage(); // set while a query runs: nothing may be saved, raised or told
  const still = what => { const q = RO.getStore(); if (q) throw fail(500, "The query " + q + " is read-only: it cannot " + what + "."); };
  const Q = C => ({ provides: ((C.queries || {}).provides) || [], uses: ((C.queries || {}).uses) || [] });
  for (const { contract: C, server } of list) {
    if (contracts[C.id]) throw new Error("Two modules share the id " + C.id);
    contracts[C.id] = C;
    const prefix = "studio/" + C.id + "/";
    const own = p => { p = String(p || ""); if (!p.startsWith(prefix) || p.includes("..")) throw fail(500, "A module reached outside its own records."); return p; };
    // the core each module sees: its own records, notices to the person, events and queries for the others, and drafts
    const core = {
      id: C.id, contract: C,
      path: name => prefix + String(name).replace(/[^a-z0-9_-]/gi, "") + ".json",
      load: (p, def) => base.store.load(own(p), def),
      read: p => base.store.read(own(p)),
      mutate: (p, def, fn, msg, who) => { still("save"); return base.store.mutate(own(p), def, fn, msg, who); },
      notify: n => { still("raise a notice"); return base.notify({ ...n, mod: C.id }); },
      emit: (ev, data, me) => { still("raise an event"); return api.emit(C.id, ev, data, me); },
      query: (name, args, me) => api.query(C.id, name, args, me),
      ai: base.ai || null,
      send: base.send, fail, clean, para, now, rid
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
    for (const q of Object.keys(m.provide || {})) {
      if (!Q(C).provides.includes(q)) throw new Error(C.id + " answers the query " + q + " without declaring it in its contract");
      if (!q.startsWith(C.id + ".")) throw new Error(C.id + " answers " + q + "; its queries are named " + C.id + ".<name>");
      if (provided[q]) throw new Error("The query " + q + " is already answered by " + provided[q]);
      provided[q] = C.id;
    }
    for (const q of Q(C).provides) if (!(m.provide || {})[q]) throw new Error(C.id + " declares the query " + q + " but does not answer it");
    mods.push({ C, m });
  }
  for (const { C } of mods) for (const q of Q(C).uses) if (!provided[q]) throw new Error(C.id + " uses the query " + q + ", which no module answers");
  const byId = id => mods.find(x => x.C.id === id);
  const safe = async (fn, label) => { try { return await fn(); } catch (e) { console.error("module " + label, e && e.stack || e); return null; } };
  // what the screen needs to draw a module before its screen loads: the contract's public face
  const face = C => ({ id: C.id, name: C.name, icon: C.icon, hue: C.hue, order: C.order, dock: !!C.dock, summary: C.summary, version: C.version, status: C.status || "live",
    records: C.records || [], routes: C.routes || [], actions: (C.actions || []).map(a => ({ id: a.id, level: a.level, what: a.what })), window: C.window || null,
    events: { emits: (C.events || {}).emits || [], listens: (C.events || {}).listens || [] }, queries: Q(C), css: !!C.css });
  const api = {
    routes, contracts, provided,
    list: () => mods.map(x => face(x.C)),
    async boot(me) {
      const out = {};
      await Promise.all(mods.map(async ({ C, m }) => { out[C.id] = m.boot ? await safe(() => m.boot(me), "boot " + C.id) : null; }));
      return out;
    },
    async emit(from, ev, data, me) {
      const C = byId(from).C;
      if (!((C.events || {}).emits || []).includes(ev)) throw fail(500, from + " raised " + ev + " without declaring it in its contract");
      for (const id of bus[ev] || []) await safe(() => byId(id).m.on[ev](copyOf(data), me, from), "event " + ev + " → " + id);
    },
    // a read-only question to another module: declared by both, answered with a copy, nothing saved while it runs
    async query(from, name, args, me) {
      const C = byId(from).C;
      if (!Q(C).uses.includes(name)) throw fail(500, from + " asked " + name + " without declaring it in its contract");
      const p = byId(provided[name]);
      const out = await RO.run(name, () => p.m.provide[name](copyOf(args || {}), me, from));
      return out === undefined ? null : copyOf(out);
    }
  };
  return api;
}
