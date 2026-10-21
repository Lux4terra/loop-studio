// Loop Studio · the registry on its own, with made-up modules and a store in memory: what it accepts, what it refuses,
// and how modules hear of each other. Prints PASS/FAIL lines for b_registry.py.
import { makeRegistry } from "../../api/_core/registry.js";

const ok = (n, c, x = "") => console.log((c ? "PASS " : "FAIL ") + n + (c || x === "" ? "" : " · " + JSON.stringify(x).slice(0, 300)));
const mem = {}, notes = [];
const store = {
  load: async (p, def) => (p in mem ? JSON.parse(JSON.stringify(mem[p])) : def()),
  read: async p => (p in mem ? { data: mem[p], sha: "x" } : null),
  mutate: async (p, def, fn) => { const d = p in mem ? mem[p] : def(); if ((await fn(d)) !== false) mem[p] = d; return d; }
};
const base = { store, send: (res, c, o) => { res.c = c; res.o = o; }, notify: async n => { notes.push(n); return n; } };
const C = (id, x = {}) => ({ id, name: id, version: 1, status: "slot", order: 1, icon: "dot", hue: 1, summary: "s", records: ["studio/" + id + "/a.json"], routes: [id], permissions: {}, actions: [], events: { emits: [], listens: [] }, window: { zero: "z", one: "o", many: "m", line: "l" }, ...x });
const throws = f => { try { f(); return false; } catch (e) { return e.message || true; } };

// what it refuses
ok("a route left out of the contract is refused", /without declaring/.test(throws(() => makeRegistry([{ contract: C("a"), server: () => ({ routes: { a: () => {}, sneaky: () => {} } }) }], base))));
ok("a core route cannot be taken", /already taken/.test(throws(() => makeRegistry([{ contract: C("a", { routes: ["boot"] }), server: () => ({ routes: { boot: () => {} } }) }], base))));
ok("two modules cannot share a route", /already taken/.test(throws(() => makeRegistry([{ contract: C("a", { routes: ["x"] }), server: () => ({ routes: { x: () => {} } }) }, { contract: C("b", { routes: ["x"] }), server: () => ({ routes: { x: () => {} } }) }], base))));
ok("two modules cannot share an id", /share the id/.test(throws(() => makeRegistry([{ contract: C("a"), server: () => ({}) }, { contract: C("a"), server: () => ({}) }], base))));
ok("listening without declaring it is refused", /without declaring/.test(throws(() => makeRegistry([{ contract: C("a"), server: () => ({ on: { "x.done": () => {} } }) }], base))));

// what it allows, and the walls between modules
let heard = [];
const R = makeRegistry([
  { contract: C("alpha", { events: { emits: ["alpha.saved"], listens: [] } }), server: core => ({
    routes: { alpha: async (req, res, me, b) => {
      if (b.op === "save") { await core.mutate(core.path("a"), () => ({ n: 0 }), d => { d.n++; }); await core.emit("alpha.saved", { n: 1 }, me); await core.notify({ t: "Saved", st: "info" }); return core.send(res, 200, { ok: true }); }
      if (b.op === "peek") { await core.load("studio/beta/b.json", () => ({})); return core.send(res, 200, {}); }
      if (b.op === "shout") { await core.emit("beta.anything", {}, me); return core.send(res, 200, {}); }
      return core.send(res, 200, { a: await core.load(core.path("a"), () => ({ n: 0 })) });
    } },
    boot: async () => ({ count: 2 })
  }) },
  { contract: C("beta", { records: ["studio/beta/b.json"], events: { emits: [], listens: ["alpha.saved"] } }), server: core => ({
    routes: { beta: async (req, res) => core.send(res, 200, {}) },
    on: { "alpha.saved": async (data, me, from) => { heard.push([data.n, from, me && me.name]); await core.mutate(core.path("b"), () => ({ seen: 0 }), d => { d.seen++; }); } },
    boot: async () => { throw new Error("a broken boot"); }
  }) }
], base);
const res = {}, me = { name: "Eliya" };
await R.routes.alpha.fn({ method: "POST" }, res, me, { op: "save" });
ok("a module saves its own records", mem["studio/alpha/a.json"] && mem["studio/alpha/a.json"].n === 1, mem);
ok("an event reaches the module that listens, with who raised it", heard.length === 1 && heard[0][0] === 1 && heard[0][1] === "alpha" && heard[0][2] === "Eliya", heard);
ok("the listener keeps its own records", mem["studio/beta/b.json"] && mem["studio/beta/b.json"].seen === 1, mem);
ok("a notice carries the module it came from", notes.length === 1 && notes[0].mod === "alpha", notes);
let e1 = null; try { await R.routes.alpha.fn({ method: "POST" }, {}, me, { op: "peek" }); } catch (e) { e1 = e; }
ok("a module cannot read another module's records", e1 && e1.http === 500 && /outside its own records/.test(e1.message), e1 && e1.message);
let e2 = null; try { await R.routes.alpha.fn({ method: "POST" }, {}, me, { op: "shout" }); } catch (e) { e2 = e; }
ok("a module cannot raise an event it has not declared", e2 && /without declaring/.test(e2.message), e2 && e2.message);
const B = await R.boot(me);
ok("boot gathers every module's figures, and a broken one does not stop the rest", B.alpha.count === 2 && B.beta === null, B);
const L = R.list();
ok("the public face of each module leaves the server's parts out", L.length === 2 && L[0].id === "alpha" && !("server" in L[0]) && L[0].window && Array.isArray(L[0].records), L[0]);
ok("routes are listed by module", R.routes.alpha.id === "alpha" && R.routes.beta.id === "beta", Object.keys(R.routes));

// ---------- queries: read-only questions, declared by the module that answers and the module that asks ----------
const Qs = (provides, uses) => ({ queries: { provides, uses } });
ok("answering a query left out of the contract is refused", /without declaring/.test(throws(() => makeRegistry([{ contract: C("a"), server: () => ({ provide: { "a.n": () => 1 } }) }], base))));
ok("a query is named after the module that answers it", /are named a\./.test(throws(() => makeRegistry([{ contract: C("a", Qs(["b.n"], [])), server: () => ({ provide: { "b.n": () => 1 } }) }], base))));
ok("a declared query must be answered", /does not answer/.test(throws(() => makeRegistry([{ contract: C("a", Qs(["a.n"], [])), server: () => ({}) }], base))));
ok("asking a query no module answers is refused", /no module answers/.test(throws(() => makeRegistry([{ contract: C("a", Qs([], ["z.n"])), server: () => ({}) }], base))));
mem["studio/gamma/g.json"] = { n: 3, list: [1, 2] };
let sneak = {};
const R2 = makeRegistry([
  { contract: C("gamma", { records: ["studio/gamma/g.json"], ...Qs(["gamma.count", "gamma.sneak"], []), events: { emits: ["gamma.x"], listens: [] } }), server: core => ({
    provide: {
      "gamma.count": async (args, me, from) => { const d = await core.load(core.path("g"), () => ({ n: 0, list: [] })); return { n: d.n, list: d.list, asked: from, who: me && me.name, args }; },
      "gamma.sneak": async (args) => {
        for (const [k, f] of [["save", () => core.mutate(core.path("g"), () => ({}), d => { d.n = 99; })], ["notify", () => core.notify({ t: "x" })], ["emit", () => core.emit("gamma.x", {})]]) { try { await f(); sneak[k] = "allowed"; } catch (e) { sneak[k] = e.message; } }
        return null;
      }
    }
  }) },
  { contract: C("delta", { ...Qs([], ["gamma.count", "gamma.sneak"]) }), server: core => ({
    routes: { delta: async (req, res, me, b) => {
      if (b.op === "ask") { const a = await core.query("gamma.count", { k: 1 }, me); a.list.push(9); const again = await core.query("gamma.count", {}, me); await core.mutate(core.path("a"), () => ({ n: 0 }), d => { d.n = again.n; }); return core.send(res, 200, { a, again }); }
      if (b.op === "sneak") { await core.query("gamma.sneak", {}, me); return core.send(res, 200, {}); }
      if (b.op === "stray") { await core.query("gamma.nothing", {}, me); return core.send(res, 200, {}); }
    } }
  }) },
  { contract: C("eps"), server: core => ({ routes: { eps: async (req, res, me) => { await core.query("gamma.count", {}, me); return core.send(res, 200, {}); } } }) }
], base);
const r1 = {};
await R2.routes.delta.fn({ method: "POST" }, r1, me, { op: "ask" });
ok("a module asks a declared query and is answered, with who asked", r1.o.a.n === 3 && r1.o.a.asked === "delta" && r1.o.a.who === "Eliya" && r1.o.a.args.k === 1, r1.o);
ok("the answer is a copy: changing it changes nothing of the answering module", r1.o.again.list.length === 2 && mem["studio/gamma/g.json"].list.length === 2, r1.o.again);
ok("after a query, the asking module saves its own records as usual", mem["studio/delta/a.json"] && mem["studio/delta/a.json"].n === 3, mem["studio/delta/a.json"]);
await R2.routes.delta.fn({ method: "POST" }, {}, me, { op: "sneak" });
ok("a query cannot save, raise a notice or raise an event", /read-only/.test(sneak.save) && /read-only/.test(sneak.notify) && /read-only/.test(sneak.emit) && mem["studio/gamma/g.json"].n === 3, sneak);
let e3 = null; try { await R2.routes.delta.fn({ method: "POST" }, {}, me, { op: "stray" }); } catch (e) { e3 = e; }
ok("asking a query left out of the contract is refused", e3 && e3.http === 500 && /without declaring/.test(e3.message), e3 && e3.message);
let e4 = null; try { await R2.routes.eps.fn({ method: "POST" }, {}, me, {}); } catch (e) { e4 = e; }
ok("a module that declares no queries cannot ask one", e4 && /without declaring/.test(e4.message), e4 && e4.message);
const F2 = R2.list().find(x => x.id === "delta");
ok("the public face carries the queries asked and answered", F2.queries.uses.includes("gamma.count") && R2.list()[0].queries.provides.length === 2 && R2.provided["gamma.count"] === "gamma", F2.queries);
