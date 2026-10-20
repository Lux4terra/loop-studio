# Loop Studio · the core API: setting up with the studio key, signing in, sessions, the account, appearance,
# the notification centre, and the records each save leaves in the data repo.
import base64, hashlib, hmac, json, re, threading, time
from harness import *

def mint(payload, key=KEY):
    p = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    s = base64.urlsafe_b64encode(hmac.new((key + "|loop-studio").encode(), p.encode(), hashlib.sha256).digest()).decode().rstrip("=")
    return p + "." + s

V = re.search(r'export const V = "([0-9a-f]+)"', open(REPO + "/api/_core/registry.gen.js").read()).group(1)
mock({"reset": True})

# ---------- before anything is set up ----------
c, j = call("ping")
ok("ping says Studio is waiting to be set up", c == 200 and j["app"] == "loop-studio" and j["setup"] is True and j["signin"] and j["cloud"], j)
ok("ping carries the built version", j.get("v") == V, (j.get("v"), V))
mock({"env": {"STUDIO_KEY": "short"}}); c, j = call("ping"); c2, j2 = call("boot")
ok("a studio key under 16 characters is not accepted", j["signin"] is False and c2 == 500 and "STUDIO_KEY" in j2["error"], (j, j2))
mock({"env": {"STUDIO_KEY": None}}); c, j = call("login", {"pass": PASS})
ok("without its keys Studio says which ones to set", c == 500 and all(k in j["error"] for k in ("LOOP_GITHUB_TOKEN", "LOOP_DATA_REPO", "STUDIO_KEY")), j)
mock({"env": {"STUDIO_KEY": KEY}})
c, j = call("login", {"pass": PASS}); ok("signing in before set-up points to the studio key", c == 409 and "studio key" in j["error"], (c, j))
c, j = call("setup", method="GET"); ok("set-up takes POST only", c == 405, c)
c, j = call("setup", {"key": "not-the-key-at-all-0000", "name": NAME, "pass": PASS})
ok("a wrong studio key sets nothing up", c == 401 and not mock()["commits"], (c, j))
for weak in ["1234567", "11111111", "12345678", "password1", "x" * 80]:
    c, j = call("setup", {"key": KEY, "name": NAME, "pass": weak})
    ok("a weak passcode is refused: " + weak[:12], c == 400, (c, j))
c, j = call("setup", {"key": KEY, "name": "E", "pass": PASS}); ok("a name is needed", c == 400, (c, j))
ok("refusals save nothing", not mock()["commits"], mock()["commits"])

# ---------- set up ----------
t0 = time.time(); c, j = call("setup", {"key": KEY, "name": NAME, "pass": PASS}); A = j.get("token")
ok("the studio key sets Studio up and signs in", c == 200 and A and j["me"]["name"] == NAME, (c, j))
acc = F("studio/account.json"); M = mock()
ok("the passcode is kept only as a salted hash", acc["ph"]["s"] and len(acc["ph"]["h"]) == 64 and PASS not in json.dumps(M["files"]), acc.get("ph"))
ok("the studio key is written nowhere", KEY not in json.dumps(M["files"]) and all(KEY not in x["message"] for x in M["commits"]), "")
ok("each save is a commit, signed by who made it", M["commits"][0]["message"] == "Studio set up" and M["commits"][0]["by"] == NAME + " via Loop Studio" and M["commits"][0]["email"].endswith(".invalid"), M["commits"][0])
I = F("studio/inbox.json")
ok("the first set-up leaves one welcome notice", len(I["items"]) == 1 and I["items"][0]["k"] == "welcome" and I["items"][0]["st"] == "info", I)
c, j = call("ping"); ok("ping now says Studio is set up", j["setup"] is False, j)

# ---------- boot ----------
n0 = len(mock()["commits"]); c, B = call("boot", tok=A)
ok("boot answers with the person, the modules, their figures and the notices", c == 200 and B["me"]["name"] == NAME and B["inbox"]["unread"] == 1 and set(B["data"]) == {"today", "briefs", "builds", "library"}, (c, list(B)))
ok("the modules come in their order", [m["id"] for m in B["mods"]] == ["today", "briefs", "builds", "library"], [m["id"] for m in B["mods"]])
ok("each module brings its contract's public face", all(m["records"] and m["routes"] and m["actions"] and m["window"] and m["summary"] for m in B["mods"]), B["mods"][0])
ok("boot carries the version and the default look", B["v"] == V and B["me"]["look"] == {"theme": "auto", "accent": "", "icons": "sig", "wall": None, "glass": 1} and B["me"]["display"] == {"fs": "m", "tf": "24"}, B["me"])
ok("the passcode's hash never leaves the server", "ph" not in json.dumps(B) and acc["ph"]["h"] not in json.dumps(B), "")
ok("reading saves nothing", len(mock()["commits"]) == n0, len(mock()["commits"]) - n0)
c, j = call("nothing-here", tok=A); ok("an unknown action is refused plainly", c == 400 and j["error"] == "Unknown action.", (c, j))
c, j = call("boot"); ok("nothing opens without a session", c == 401, c)
c, d, h = call("boot", tok=A, raw=True); ok("answers are never cached", h.get("Cache-Control") == "no-store" and "noindex" in (h.get("X-Robots-Tag") or ""), dict(h))

# ---------- sessions ----------
c, j = call("boot", tok=A[:-3] + ("aaa" if not A.endswith("aaa") else "bbb")); ok("a changed signature is refused", c == 401, c)
c, j = call("boot", tok=mint({"k": "studio", "v": 1, "e": int(time.time() * 1000) - 1000})); ok("an expired session is refused", c == 401, c)
c, j = call("boot", tok=mint({"k": "studio", "v": 1, "e": int(time.time() * 1000) + 86400000})); ok("a session made with the key works", c == 200, c)
c, j = call("boot", tok=mint({"k": "studio", "v": 1, "e": int(time.time() * 1000) + 86400000}, key="another-studio-key-000")); ok("a session made with another key is refused", c == 401, c)
mock({"env": {"STUDIO_KEY": "rotated-studio-key-0000000"}}); c, j = call("boot", tok=A); mock({"env": {"STUDIO_KEY": KEY}}); c2, j2 = call("boot", tok=A)
ok("rotating the studio key signs every device out", c == 401 and c2 == 200, (c, c2))

# ---------- signing in ----------
t0 = time.time(); c, j = call("login", {"pass": "wrong-pass-0000"}); dt = time.time() - t0
ok("a wrong passcode is refused, after a pause", c == 401 and dt > .8 and j["error"] == "That passcode is not right.", (c, dt))
c, j = call("login", {"pass": PASS}); L1 = j.get("token")
ok("the right passcode signs in", c == 200 and L1, (c, j))
a2 = F("studio/account.json"); n0 = len(mock()["commits"]); call("login", {"pass": PASS})
ok("the first sign-in of the day is noted once", a2.get("logins") == 1 and a2.get("last") and len(mock()["commits"]) == n0, (a2.get("logins"), len(mock()["commits"]) - n0))
c, j = call("login", {}); ok("an empty passcode is asked for", c == 400, c)

# ---------- the account ----------
c, j = call("me", {"name": "  Eliya   N.  "}, tok=A); ok("the name is kept, tidied", c == 200 and j["me"]["name"] == "Eliya N.", j)
c, j = call("me", {"name": "x"}, tok=A); ok("a name of one letter is refused", c == 400, j)
c, j = call("me", {"look": {"theme": "dark", "accent": "#AABBCC", "icons": "quiet", "wall": {"kind": "preset", "v": "dusk", "dim": 37}, "glass": 2}}, tok=A); Lk = j["me"]["look"]
ok("a look is kept: theme, accent, icons, wallpaper, windows", Lk == {"theme": "dark", "accent": "#aabbcc", "icons": "quiet", "wall": {"kind": "preset", "v": "dusk", "dim": 35}, "glass": 2}, Lk)
c, j = call("me", {"look": {"theme": "neon", "accent": "red; x:y", "icons": "huge", "wall": {"kind": "preset", "v": "nowhere", "dim": 999}, "glass": 7}}, tok=A); Lk = j["me"]["look"]
ok("unknown values are kept out", Lk["theme"] == "dark" and Lk["accent"] == "" and Lk["icons"] == "quiet" and Lk["wall"] == {"kind": "preset", "v": "dusk", "dim": 80} and Lk["glass"] == 1, Lk)
c, j = call("me", {"look": {"wall": {"kind": "daily", "dim": 10}}}, tok=A); ok("a new wallpaper each day is kept", j["me"]["look"]["wall"] == {"kind": "daily", "dim": 10}, j["me"]["look"])
c, j = call("me", {"look": {"wall": None}}, tok=A); ok("the wallpaper can be taken away", j["me"]["look"]["wall"] is None, j["me"]["look"])
c, j = call("me", {"display": {"fs": "xl", "tf": "12"}}, tok=A); c2, j2 = call("me", {"display": {"fs": "huge", "tf": 7}}, tok=A)
ok("display: text size and time are kept to known values", j["me"]["display"] == {"fs": "xl", "tf": "12"} and j2["me"]["display"] == {"fs": "xl", "tf": "12"}, (j, j2))
ok("each change says what it was", [x["message"] for x in mock()["commits"][-3:]] == ["Appearance", "Display", "Display"], [x["message"] for x in mock()["commits"][-3:]])

# saves that land at the same moment both keep their change
out = []
def save(b): out.append(call("me", b, tok=A)[0])
ts = [threading.Thread(target=save, args=({"look": {"theme": "light"}},)), threading.Thread(target=save, args=({"display": {"fs": "l"}},))]
[t.start() for t in ts]; [t.join() for t in ts]
a3 = F("studio/account.json"); ok("two saves at once both land", out == [200, 200] and a3["look"]["theme"] == "light" and a3["display"]["fs"] == "l", (out, a3.get("look"), a3.get("display")))

# ---------- passcode ----------
c, j = call("me", {"pass": {"now": "wrong-pass-0000", "next": "another-pass-77"}}, tok=A); ok("changing the passcode needs the current one", c == 401, c)
c, j = call("me", {"pass": {"now": PASS, "next": "short"}}, tok=A); ok("the new passcode must be strong enough", c == 400, c)
c, j = call("me", {"pass": {"now": PASS, "next": "another-pass-77"}}, tok=A); A2 = j.get("token")
c2, j2 = call("boot", tok=A); c3, j3 = call("boot", tok=L1); c4, j4 = call("boot", tok=A2)
ok("a new passcode signs every other device out and keeps this one", c == 200 and c2 == 401 and c3 == 401 and c4 == 200, (c, c2, c3, c4))
c, j = call("login", {"pass": PASS}); c2, j2 = call("login", {"pass": "another-pass-77"}); ok("only the new passcode signs in", c == 401 and c2 == 200, (c, c2))

# ---------- resetting with the key ----------
c, j = call("setup", {"key": KEY, "name": NAME, "pass": PASS}); A3 = j.get("token"); c2, j2 = call("boot", tok=A2)
ok("the studio key resets the passcode and signs other devices out", c == 200 and c2 == 401 and call("boot", tok=A3)[0] == 200, (c, c2))
ok("a reset is recorded as one", mock()["commits"][-1]["message"] == "Passcode reset with the studio key", mock()["commits"][-1])
ok("a reset leaves no second welcome", len([x for x in F("studio/inbox.json")["items"] if x["k"] == "welcome"]) == 1, "")

# ---------- notifications ----------
c, j = call("inbox", {"op": "seen"}, tok=A3); c2, B = call("boot", tok=A3)
ok("seen notices no longer count as new", c == 200 and B["inbox"]["unread"] == 0 and B["me"]["seenAt"], B["inbox"])
wid = B["inbox"]["items"][0]["id"]
c, j = call("inbox", {"op": "done", "id": "n_missing"}, tok=A3); ok("resolving a notice that is not there says so", c == 404, c)
c, j = call("inbox", {"op": "done", "id": wid}, tok=A3); ok("a notice can be resolved", c == 200 and j["items"][0]["st"] == "done", j)
n0 = len(mock()["commits"]); call("inbox", {"op": "done", "id": wid}, tok=A3); ok("resolving twice saves once", len(mock()["commits"]) == n0, "")
c, j = call("inbox", tok=A3); ok("the notices can be read on their own", c == 200 and len(j["items"]) == 1, j)
c, j = call("inbox", {"op": "nope"}, tok=A3); ok("an unknown notice action is refused", c == 400, c)

# ---------- the page and its headers ----------
c, d, h = get("/app/")
ok("the page is served with a strict content policy", c == 200 and "script-src 'self'" in (h.get("Content-Security-Policy") or "") and "unsafe-inline" not in (h.get("Content-Security-Policy") or "").split("style-src")[0] and h.get("X-Content-Type-Options") == "nosniff", dict(h))
ok("the page carries no inline script", not re.search(rb"<script(?![^>]*\bsrc=)[^>]*>", d), re.findall(rb"<script[^>]*>", d))
c, d, h = get("/app/sw.js"); ok("the service worker is never cached by the network", c == 200 and h.get("Cache-Control") == "no-cache", dict(h))

# ---------- an empty data repo ----------
mock({"reset": True, "empty": True}); c, j = call("ping"); c2, j2 = call("setup", {"key": KEY, "name": NAME, "pass": PASS})
ok("a brand-new, empty data repo works from the first save", j["setup"] is True and c2 == 200 and F("studio/account.json"), (j, c2, j2))
ok("the server reaches nothing but the data repo", not mock()["outside"], mock()["outside"])

# ---------- too many tries (last: the count lasts for the instance) ----------
codes = [call("login", {"pass": "wrong-pass-%04d" % i})[0] for i in range(6)]; c, j = call("login", {"pass": PASS})
ok("after six wrong passcodes, signing in waits 15 minutes", codes == [401] * 6 and c == 429, (codes, c))
codes = [call("setup", {"key": "wrong-key-00000000-%d" % i, "name": NAME, "pass": PASS})[0] for i in range(6)]; c, j = call("setup", {"key": KEY, "name": NAME, "pass": PASS})
ok("after six wrong studio keys, set-up waits too", codes == [401] * 6 and c == 429, (codes, c))
summary()
