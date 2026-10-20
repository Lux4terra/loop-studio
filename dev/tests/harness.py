# Loop Studio · the shared test harness: the local mock, API calls, checks, and a browser page signed in.
# Every suite imports it: `from harness import *`.
import json, os, sys, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
BASE = "http://localhost:" + os.environ.get("SPORT", "8791"); APP = BASE + "/app/"
KEY = "test-studio-key-0123456789"; PASS = "loop-pass-2026"; NAME = "Eliya"
R = []

def ok(name, cond, why=""):
    R.append((name, bool(cond))); print(("PASS " if cond else "FAIL ") + name + (" · " + str(why)[:400] if (why != "" and not cond) else ""), flush=True)

def mock(u=None):
    q = urllib.request.Request(BASE + "/__mock", data=json.dumps(u).encode() if u is not None else None, method="POST" if u is not None else "GET")
    return json.loads(urllib.request.urlopen(q).read())

def call(a, body=None, tok=None, q="", method=None, hdr=None, raw=False):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    if hdr: h.update(hdr)
    r = urllib.request.Request(BASE + "/api/studio?a=" + a + q, data=(json.dumps(body).encode() if body is not None else None), headers=h, method=method or ("POST" if body is not None else "GET"))
    try:
        res = urllib.request.urlopen(r); d = res.read()
        return (res.status, d, res.headers) if raw else (res.status, json.loads(d or b"{}"))
    except urllib.error.HTTPError as e:
        d = e.read(); return (e.code, d, e.headers) if raw else (e.code, json.loads(d or b"{}"))

def get(path):
    try:
        res = urllib.request.urlopen(BASE + path); return res.status, res.read(), res.headers
    except urllib.error.HTTPError as e: return e.code, e.read(), e.headers

F = lambda p: mock()["files"].get(p, {}).get("data")

def setup():
    """A fresh store and Studio set up with the key; returns the session token."""
    mock({"reset": True})
    c, j = call("setup", {"key": KEY, "name": NAME, "pass": PASS})
    assert c == 200, (c, j)
    return j["token"]

def summary():
    p = sum(1 for _, c in R if c); f = len(R) - p
    print("RESULT %d pass, %d fail" % (p, f)); sys.exit(1 if f else 0)

# ---------- the browser ----------
PHONE = {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2, "has_touch": True, "is_mobile": True}
SMALL = {"viewport": {"width": 360, "height": 740}, "device_scale_factor": 2, "has_touch": True, "is_mobile": True}
LAPTOP = {"viewport": {"width": 1440, "height": 900}, "device_scale_factor": 1}

async def page_for(b, tok=None, dev=None, scheme="light", store=None, wait="#main .fade", sw=False):
    ctx = await b.new_context(**(dev or PHONE), color_scheme=scheme, service_workers="allow" if sw else "block")
    st = dict(store or {});
    if tok: st["tok"] = tok
    if st: await ctx.add_init_script('if(!sessionStorage.getItem("seeded")){localStorage.setItem("loop_studio",JSON.stringify(%s));sessionStorage.setItem("seeded","1")}' % json.dumps(st))
    pg = await ctx.new_page(); errs = []; outside = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
    pg.on("request", lambda r: outside.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith("data:") else None)
    await pg.goto(APP)
    if wait: await pg.wait_for_selector(wait, timeout=15000)
    await pg.wait_for_timeout(300)
    pg.errs, pg.outside = errs, outside
    return pg

def shots_dir(name):
    d = os.path.join(HERE, "shots_" + name); os.makedirs(d, exist_ok=True); return d
