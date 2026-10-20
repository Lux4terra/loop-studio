# Today · the module's own checks, run by dev/tests/m_modules.py with the shared harness (h) and its contract (C).
def run(h, C):
    A = h.setup()
    route = C["routes"][0]
    c, j = h.call(route, tok=A)
    h.ok("today: its screen reads its record, empty at first", c == 200 and j.get("ok") and isinstance(j.get(route), dict) and j[route].get("v") == 1, (c, j))
    before = len(h.mock()["commits"])
    h.call(route, tok=A); h.call("boot", tok=A)
    h.ok("today: reading saves nothing", len(h.mock()["commits"]) == before, len(h.mock()["commits"]) - before)
    c, j = h.call(route, {"op": "anything"}, tok=A)
    h.ok("today: changes wait for the module's own build", c == 400 and "own build" in j.get("error", ""), (c, j))
    c, j = h.call(route)
    h.ok("today: nothing opens without signing in", c == 401, c)
    c, j = h.call("boot", tok=A)
    h.ok("today: Home receives its figure", c == 200 and j["data"]["today"]["count"] == 0, j.get("data", {}).get("today"))
