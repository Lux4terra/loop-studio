# Loop Studio · the registry and the build: module contracts, the walls between modules, the generated registry,
# tokens as the one source of colour, type, radius and motion, the translation layer, nothing of KERUB left, and an
# app that installs.
import glob, importlib.util, json, os, re, shutil, subprocess, tempfile
from harness import *
from PIL import Image

spec = importlib.util.spec_from_file_location("build", os.path.join(REPO, "dev", "build.py")); B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)
rd = lambda p: open(p, encoding="utf-8").read()
PUBLIC = os.path.join(REPO, "public", "app")
IDS = sorted(d for d in os.listdir(os.path.join(REPO, "modules")) if os.path.isdir(os.path.join(REPO, "modules", d)) and not d.startswith((".", "_")))

# ---------- the build ----------
r = subprocess.run(["python3", os.path.join(REPO, "dev", "build.py"), "--check"], capture_output=True, text=True)
ok("what Vercel serves matches the sources (the build is current)", r.returncode == 0, r.stdout + r.stderr)
Cs, errs = B.contracts()
ok("the four module slots are in place", [C["id"] for C in Cs] == ["today", "briefs", "builds", "library"], [C["id"] for C in Cs])
ok("every contract is complete", not errs, errs)
for C in Cs:
    d = os.path.join(REPO, "modules", C["id"])
    ok(C["id"] + ": one folder holds its contract, server, screen, test and notes", all(os.path.exists(os.path.join(d, f)) for f in ["module.json", "server.js", "screen.js", "test.py", "NOTES.md"]), os.listdir(d))
    ok(C["id"] + ": every action declares its level", all(a["level"] in ("do", "prepare", "raise") for a in C["actions"]) and C["actions"], C["actions"])
    ok(C["id"] + ": its records sit under its own folder", all(r.startswith("studio/" + C["id"] + "/") for r in C["records"]), C["records"])
gen = rd(os.path.join(REPO, "api", "_core", "registry.gen.js"))
ok("the server's registry imports exactly the module folders", sorted(re.findall(r'from "\.\./\.\./modules/([\w-]+)/server\.js"', gen)) == IDS, re.findall(r'modules/([\w-]+)/', gen))
ok("each module's screen is built on its own, loaded only when its app opens", sorted(f[:-3] for f in os.listdir(os.path.join(PUBLIC, "m"))) == IDS and "m/" not in rd(os.path.join(PUBLIC, "index.html")), os.listdir(os.path.join(PUBLIC, "m")))
left = [f for f in glob.glob(PUBLIC + "/**/*", recursive=True) if os.path.isfile(f) and f.endswith((".html", ".js", ".css", ".webmanifest", ".json")) and re.search(r"__V__|__BG_\w+__", rd(f))]
ok("no placeholder is left in what is served", not left, left)
V = re.search(r'export const V = "(\w+)"', gen).group(1)
ok("one version is stamped into the page, the service worker and the registry", rd(os.path.join(PUBLIC, "index.html")).count("?v=" + V) == 4 and ('"loop-studio-%s"' % V) in rd(os.path.join(PUBLIC, "sw.js")) and ('const V = "%s"' % V) in rd(os.path.join(PUBLIC, "shell.js")), V)
for f in ["shell.js", "sw.js", "paint.js"] + ["m/%s.js" % i for i in IDS]:
    r = subprocess.run(["node", "--check", os.path.join(PUBLIC, f)], capture_output=True, text=True)
    ok("built " + f + " parses", r.returncode == 0, r.stderr)

# the contract check refuses what it should
def bad(edit, want):
    tmp = tempfile.mkdtemp(); shutil.copytree(os.path.join(REPO, "modules"), os.path.join(tmp, "modules"))
    edit(os.path.join(tmp, "modules"))
    old = B.MODS; B.MODS = os.path.join(tmp, "modules")
    try: _, e = B.contracts()
    finally: B.MODS = old; shutil.rmtree(tmp)
    return any(want in x for x in e), e
def cedit(mid, fn):
    def go(base):
        p = os.path.join(base, mid, "module.json"); C = json.load(open(p)); fn(C); json.dump(C, open(p, "w"))
    return go
for label, edit, want in [
    ("an action without a level", cedit("today", lambda C: C["actions"][0].update(level="maybe")), "use do, prepare or raise"),
    ("a record outside its folder", cedit("today", lambda C: C.update(records=["studio/briefs/briefs.json"])), "must sit under studio/today/"),
    ("a route another module serves", cedit("today", lambda C: C.update(routes=["briefs"])), "already served by"),
    ("a route of the core", cedit("today", lambda C: C.update(routes=["boot"])), "belongs to the core"),
    ("an icon the shell does not have", cedit("today", lambda C: C.update(icon="unicorn")), "not in the shell's icon set"),
    ("a language without its file", cedit("today", lambda C: C.update(i18n=["en", "fr"])), "i18n/fr.json is missing"),
    ("a contract missing its window", cedit("today", lambda C: C.pop("window")), "the contract has no window"),
    ("an id that differs from its folder", cedit("today", lambda C: C.update(id="tomorrow")), "must match its folder"),
    ("a folder without its test", lambda base: os.remove(os.path.join(base, "today", "test.py")), "the folder has no test.py")]:
    hit, e = bad(edit, want); ok("the build refuses " + label, hit, e)

# the version follows the content
tmp = tempfile.mkdtemp(); shutil.copytree(os.path.join(REPO, "app"), os.path.join(tmp, "app")); shutil.copytree(os.path.join(REPO, "modules"), os.path.join(tmp, "modules"))
oA, oM = B.APP, B.MODS; B.APP, B.MODS = os.path.join(tmp, "app"), os.path.join(tmp, "modules")
v1 = B.version(B.contracts()[0]); open(os.path.join(tmp, "modules", "today", "screen.js"), "a").write("\n// a change\n"); v2 = B.version(B.contracts()[0])
# and translations merge from the shell and the modules
os.makedirs(os.path.join(tmp, "app", "i18n"), exist_ok=True); os.makedirs(os.path.join(tmp, "modules", "today", "i18n"), exist_ok=True)
json.dump({"Settings": "Réglages", "Home": "Accueil"}, open(os.path.join(tmp, "app", "i18n", "fr.json"), "w"))
json.dump({"No focus set yet": "Pas encore de priorité"}, open(os.path.join(tmp, "modules", "today", "i18n", "fr.json"), "w"))
out, g = os.path.join(tmp, "out"), os.path.join(tmp, "gen.js"); B.build(out, g)
fr = json.load(open(os.path.join(out, "i18n", "fr.json")))
ok("a change to a screen gives a new version", v1 != v2, (v1, v2))
ok("translations from the shell and a module merge into one file per language", fr == {"Settings": "Réglages", "Home": "Accueil", "No focus set yet": "Pas encore de priorité"}, fr)
ok("a language with its files joins the language list", '["fr", "Français"]' in rd(os.path.join(out, "shell.js")), re.search(r"/\*LANGS\*/.*?/\*/LANGS\*/", rd(os.path.join(out, "shell.js"))).group(0))
json.dump({"Settings": "Paramètres"}, open(os.path.join(tmp, "modules", "today", "i18n", "fr.json"), "w"))
_, e = B.translations(B.contracts()[0])
ok("two files translating one string differently stop the build", any("differently" in x for x in e), e)
B.APP, B.MODS = oA, oM; shutil.rmtree(tmp)
r = subprocess.run(["python3", os.path.join(REPO, "dev", "i18n", "extract.py")], capture_output=True, text=True)
S = json.load(open(os.path.join(REPO, "dev", "i18n", "strings.json")))
ok("every string a person reads is gathered for translators", r.returncode == 0 and len(S) > 150 and {"Settings", "Needs you", "No focus set yet", "That passcode is not right.", "builds running"} <= set(S), r.stdout + r.stderr)

# ---------- the registry, on its own ----------
r = subprocess.run(["node", os.path.join(HERE, "registry_unit.mjs")], capture_output=True, text=True)
for line in r.stdout.splitlines():
    if line.startswith(("PASS ", "FAIL ")): ok("registry: " + line[5:].split(" · ")[0], line.startswith("PASS"), line)
ok("registry: the unit checks ran", r.stdout.count("PASS") + r.stdout.count("FAIL") >= 14, r.stderr[-400:])

# ---------- the walls between modules ----------
for i in IDS:
    sv, sc = rd(os.path.join(REPO, "modules", i, "server.js")), rd(os.path.join(REPO, "modules", i, "screen.js"))
    others = [o for o in IDS if o != i]
    ok(i + ": its server imports nothing and names no other module's records", not re.search(r"^\s*import\b|require\(", sv, re.M) and not any("studio/" + o + "/" in sv or "../" + o in sv for o in others), "")
    ok(i + ": its screen registers only itself and reaches the shell only through ctx", re.findall(r'Studio\.register\("([\w-]+)"', sc) == [i] and not re.search(r"\bG\.|\bMODS\b|localStorage|sessionStorage|\bfetch\(|(?<![.\w])api\(|document\.|window\.", sc), re.findall(r"\bG\.|\bMODS\b|localStorage|\bfetch\(|(?<![.\w])api\(|document\.|window\.", sc))
    ok(i + ": its test runs with the shared harness", re.search(r"^def run\(h, C\):", rd(os.path.join(REPO, "modules", i, "test.py")), re.M), "")

# ---------- tokens: the one source of colour, type, radius and motion ----------
NAMED = r"\b(?:white|black|red|green|blue|gray|grey|silver|gold|ivory|navy|orange|purple|pink|yellow|brown|beige|teal|maroon)\b"
def css_faults(css):
    f = []
    body = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    for prop, val in re.findall(r"([\w-]+)\s*:\s*([^;{}]+)", body):
        if prop.startswith("--"): f.append("defines a token " + prop); continue
        if re.search(r"#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\((?!\s*var\()", val): f.append(prop + ": " + val.strip()[:60])
        if re.search(NAMED, val) and prop not in ("animation", "animation-name"): f.append("named colour in " + prop)
        if re.search(r"hsla?\(\s*var\([^)]*\)\s+\d", val): f.append("raw hsl part in " + prop)
        if prop in ("font", "font-family") and "var(--font-" not in val and val.strip() not in ("inherit",): f.append(prop + " without a font token")
        if prop in ("transition", "animation", "transition-timing-function", "animation-timing-function") and re.search(r"cubic-bezier|\bease-in|\bease-out|\b(?<!-)ease\b|\b0?\.\d+s\b|\b[1-9]\d*m?s\b", re.sub(r"var\(--[\w-]+\)", "", val)): f.append(prop + " with its own timing: " + val.strip()[:60])
        if prop.startswith("border") and "radius" in prop and not re.fullmatch(r"(?:\s*(?:var\(--r-[\w-]+\)|calc\(var\(--r-[\w-]+\)[^)]*\)|\d+%|0)\s*)+", val.strip()): f.append("radius " + val.strip())
    return f
probe = {"a{color:#fff}": 1, "b{font:16px Arial}": 1, "c{transition:opacity .3s ease}": 1, "d{border-radius:12px}": 1, "e{background:rgba(0,0,0,.5)}": 1, "f{color:white}": 1,
         "g{color:var(--text);border-radius:var(--r-m);transition:opacity var(--dur-2) var(--ease)}": 0}
ok("the token check itself catches raw values, and lets tokens through", all(bool(css_faults(k)) == bool(v) for k, v in probe.items()), {k: css_faults(k) for k in probe})
f1 = css_faults(rd(os.path.join(REPO, "app", "shell.css")))
ok("the shell's styles bring no colour, font, radius or easing of their own", not f1, f1[:8])
js_faults = []
for f in [os.path.join(REPO, "app", "shell.js"), os.path.join(REPO, "app", "index.html"), os.path.join(REPO, "app", "paint.js")] + glob.glob(os.path.join(REPO, "modules", "*", "screen.js")):
    s = rd(f)
    for m in re.finditer(r"""["'`:(\s](#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b(?![\w-])|\brgba?\(\s*\d|\bhsla?\(\s*\d|font-family|cubic-bezier""", s): js_faults.append(os.path.basename(f) + ": " + m.group(0))
    for m in re.finditer(r'style="([^"]*)"', s): js_faults += [os.path.basename(f) + ": " + x for x in css_faults(m.group(1).replace("${", "").replace("}", "")) if "token" not in x]
ok("the scripts and screens bring no colour, font or easing of their own", not js_faults, js_faults[:8])
tok = rd(os.path.join(REPO, "app", "tokens.css"))
used = set(re.findall(r"var\((--[\w-]+)", rd(os.path.join(REPO, "app", "shell.css")) + rd(os.path.join(REPO, "app", "shell.js")) + "".join(rd(f) for f in glob.glob(os.path.join(REPO, "modules", "*", "screen.js")))))
undefined = sorted(u for u in used if not u.endswith("-") and not re.search(re.escape(u) + r"\s*:", tok) and u != "--h")
ok("every token a screen uses is defined in tokens.css", not undefined, undefined)
for th in ["light", "dark"]:
    block = tok if th == "light" else tok[tok.index(':root[data-theme="dark"]'):]
    names = set(re.findall(r"(--[\w-]+)\s*:", tok[:tok.index("@media")] if th == "light" else block))
    need = {"--bg", "--surface", "--fill", "--text", "--text-2", "--accent", "--accent-ink", "--bar", "--panel", "--shadow-1"}
    ok("the " + th + " theme defines every colour the screens need", need <= names, need - names)
ok("every wallpaper the screens offer is a token", all("--wall-" + w + ":" in tok for w in re.search(r'const WALLS = \[([^\]]+)\]', rd(os.path.join(REPO, "app", "shell.js"))).group(1).replace('"', "").replace(" ", "").split(",")), "")
ok("the server keeps the same wallpapers the screen offers", re.search(r'WALLS = \[([^\]]+)\]', rd(os.path.join(REPO, "api", "studio.js"))).group(1).replace(" ", "").split(",").__len__() == 6, "")

# ---------- nothing of KERUB left ----------
SHIP = [os.path.join(REPO, x) for x in ("api", "app", "modules", "public")] + [os.path.join(REPO, "vercel.json"), os.path.join(REPO, "package.json")]
hits = []
for base in SHIP:
    for f in ([base] if os.path.isfile(base) else [p for p in glob.glob(base + "/**/*", recursive=True) if os.path.isfile(p)]):
        if f.endswith((".png", ".pyc")) or "__pycache__" in f: continue
        s = rd(f)
        for m in re.finditer(r"(?i)kerub|kerubem|happy soul|nyarutarama|playfair|\bjost\b|sacramento|managed to perfection|#b8943f|#d4af6a|#1c1814|#f7f3ec|\bestates?\b|\btenants?\b|\bresidents?\b|\bmomo\b|flutterwave", s): hits.append(os.path.relpath(f, REPO) + ": " + m.group(0))
ok("no KERUB name, mark, colour, font or estate word in anything Studio ships", not hits, hits[:10])
ok("no payment or people records in Studio's API", not re.search(r"(?i)payment|invoice|ledger|people\.json|accounts\.json", rd(os.path.join(REPO, "api", "studio.js"))), "")

# ---------- what Vercel uploads ----------
vi = os.path.join(REPO, ".vercelignore")
served = [os.path.relpath(f, REPO) for base in ("public", "api", "modules") for f in glob.glob(os.path.join(REPO, base, "**", "*"), recursive=True) if os.path.isfile(f) and "__pycache__" not in f]
r = subprocess.run(["git", "-C", REPO, "-c", "core.excludesFile=" + vi, "check-ignore", "--no-index", "--stdin"], input="\n".join(served), capture_output=True, text=True)
ok("nothing Vercel serves or runs is left out of the upload", served and not r.stdout.strip(), r.stdout.split()[:6])
r = subprocess.run(["git", "-C", REPO, "-c", "core.excludesFile=" + vi, "check-ignore", "--no-index", "--stdin"], input="app/shell.js\ndev/build.py", capture_output=True, text=True)
ok("the sources and dev tools stay out of the upload", sorted(r.stdout.split()) == ["app/shell.js", "dev/build.py"], r.stdout)

# ---------- an app that installs ----------
man = json.load(open(os.path.join(PUBLIC, "manifest.webmanifest")))
bgL, bgD = B.token_bg()
ok("the manifest names Studio and opens standalone at /app/", man["name"] == "Loop Studio" and man["short_name"] == "Studio" and man["start_url"] == "/app/" and man["scope"] == "/app/" and man["display"] == "standalone", man)
ok("the manifest's colours come from the tokens", man["background_color"] == bgL and man["theme_color"] == bgL, (man["background_color"], bgL))
sizes = {i["src"]: (i["sizes"], i.get("purpose", "any")) for i in man["icons"]}
ok("the manifest carries 192, 512 and maskable icons", sizes.get("icon-192.png", ("",))[0] == "192x192" and sizes.get("icon-512.png", ("",))[0] == "512x512" and any(p == "maskable" for _, p in sizes.values()), sizes)
for f, px in [("icon-180.png", 180), ("icon-192.png", 192), ("icon-512.png", 512), ("icon-mask.png", 512)]:
    p = os.path.join(PUBLIC, f); ok("icon " + f + " is " + str(px) + " pixels square", os.path.exists(p) and Image.open(p).size == (px, px), Image.open(p).size if os.path.exists(p) else "missing")
html = rd(os.path.join(PUBLIC, "index.html"))
ok("the page asks for a phone's full screen and its Home Screen icon", 'viewport-fit=cover' in html and 'apple-touch-icon" href="icon-180.png"' in html and 'apple-mobile-web-app-capable" content="yes"' in html and 'rel="manifest"' in html, "")
ok("the page's theme colours come from the tokens", 'content="%s" media="(prefers-color-scheme: light)"' % bgL in html and 'content="%s" media="(prefers-color-scheme: dark)"' % bgD in html, "")
sw = rd(os.path.join(PUBLIC, "sw.js")); shell = re.search(r"const SHELL = \[([^\]]+)\]", sw).group(1)
listed = [x.strip().strip('"').split("?")[0] for x in shell.split(",")]
ok("everything the service worker keeps exists", all(os.path.exists(os.path.join(PUBLIC, x if x != "./" else "index.html")) for x in listed), listed)
ok("the service worker never keeps data calls", "/api/" not in sw.replace("// ", "") or 'startsWith("/app/")' in sw, "")
summary()
