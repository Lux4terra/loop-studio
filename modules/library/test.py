# Library · the module's own checks, run by dev/tests/m_modules.py with the shared harness (h) and its contract (C).
def run(h, C):
    A = h.setup()
    route = C["routes"][0]
    c, j = h.call(route, tok=A)
    h.ok("library: its screen reads its record, empty at first", c == 200 and j.get("ok") and isinstance(j.get(route), dict) and j[route].get("v") == 1, (c, j))
    before = len(h.mock()["commits"])
    h.call(route, tok=A); h.call("boot", tok=A)
    h.ok("library: reading saves nothing", len(h.mock()["commits"]) == before, len(h.mock()["commits"]) - before)
    c, j = h.call(route, {"op": "anything"}, tok=A)
    h.ok("library: changes wait for the module's own build", c == 400 and "own build" in j.get("error", ""), (c, j))
    c, j = h.call(route)
    h.ok("library: nothing opens without signing in", c == 401, c)
    c, j = h.call("boot", tok=A)
    h.ok("library: Home receives its figure", c == 200 and j["data"]["library"]["count"] == 0, j.get("data", {}).get("library"))
    h.mock({"put": {"path": "studio/library/items.json", "data": {"v": 1, "items": [{"id": "i1", "kind": "Test", "name": "Tokens guard", "purpose": "No colour outside tokens.css"}]}}})
    c, j = h.call("boot", tok=A)
    h.ok("library: items filed before its build are counted on Home", j["data"]["library"]["count"] == 1, j["data"]["library"])
