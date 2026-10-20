#!/usr/bin/env python3
# Loop Studio · the build. Reads the shell (app/) and the module folders (modules/), checks every module's contract,
# and writes what Vercel serves (public/app/) and the server's registry (api/_core/registry.gen.js):
#   - one version, from the content itself, stamped into the page, the service worker and the registry;
#   - each module's screen as its own file (public/app/m/<id>.js), loaded only when its app opens;
#   - translations merged per language (public/app/i18n/<lang>.json), and the language list written into the shell;
#   - colours for the manifest and the page's theme read from tokens.css, so tokens stay the one source.
# Usage: python3 dev/build.py            build
#        python3 dev/build.py --check    build to a scratch folder and say whether public/ and the registry are current
import hashlib, json, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(HERE)
APP, MODS = os.path.join(REPO, "app"), os.path.join(REPO, "modules")
OUT, GEN = os.path.join(REPO, "public", "app"), os.path.join(REPO, "api", "_core", "registry.gen.js")
CORE_ROUTES = {"ping", "setup", "login", "boot", "me", "inbox"}
LEVELS = {"do", "prepare", "raise"}
REQ = ["id", "name", "version", "status", "order", "icon", "hue", "summary", "records", "routes", "permissions", "actions", "events", "window", "i18n", "tests"]
FILES = ["server.js", "screen.js", "test.py", "NOTES.md"]
LANG_NAMES = {"fr": "Français", "rw": "Ikinyarwanda", "sw": "Kiswahili", "de": "Deutsch", "es": "Español", "rn": "Ikirundi", "zh": "中文", "ja": "日本語", "ko": "한국어", "ti": "ትግርኛ", "pt": "Português", "ar": "العربية"}
TEXT = {".html", ".js", ".css", ".webmanifest", ".json", ".txt"}

def rd(p, mode="r"):
    with open(p, mode, **({} if "b" in mode else {"encoding": "utf-8"})) as f: return f.read()

def shell_icons():
    s = rd(os.path.join(APP, "shell.js")); block = s[s.index("const P = {"):s.index("};", s.index("const P = {"))]
    return set(re.findall(r"(?:^|[\s{,])([A-Za-z]\w*):\s*'", block))

def contracts():
    errs, out, icons = [], [], shell_icons()
    for d in sorted(os.listdir(MODS)):
        p = os.path.join(MODS, d)
        if not os.path.isdir(p) or d.startswith((".", "_")): continue
        e = lambda m: errs.append(d + ": " + m)
        try: C = json.loads(rd(os.path.join(p, "module.json")))
        except Exception as x: e("module.json is missing or not valid JSON (" + str(x) + ")"); continue
        for k in REQ:
            if k not in C: e("the contract has no " + k)
        if C.get("id") != d: e("its id must match its folder")
        if not re.match(r"^[a-z][a-z0-9-]{1,23}$", str(C.get("id", ""))): e("its id must be lower case, 2 to 24 characters")
        if C.get("status") not in ("slot", "live"): e("status is slot or live")
        if not isinstance(C.get("hue"), int) or not 0 <= C["hue"] <= 359: e("hue is a whole number from 0 to 359")
        if C.get("icon") not in icons: e("its icon " + repr(C.get("icon")) + " is not in the shell's icon set")
        recs = C.get("records") or []
        if not recs: e("it keeps no records")
        for r in recs:
            if not str(r).startswith("studio/" + d + "/") or not str(r).endswith(".json") or ".." in str(r): e("its record " + str(r) + " must sit under studio/" + d + "/ and end in .json")
        for r in C.get("routes") or []:
            if not re.match(r"^[a-z][a-z0-9-]*$", r): e("route " + r + " must be lower case")
            if r in CORE_ROUTES: e("route " + r + " belongs to the core")
        if not C.get("routes"): e("it answers no route")
        for a in C.get("actions") or []:
            if not a.get("id") or not a.get("what"): e("each action needs an id and what it does")
            if a.get("level") not in LEVELS: e("action " + str(a.get("id")) + " has level " + repr(a.get("level")) + "; use do, prepare or raise")
        ev = C.get("events") or {}
        if not isinstance(ev.get("emits"), list) or not isinstance(ev.get("listens"), list): e("events needs emits and listens lists")
        w = C.get("window") or {}
        for k in ("zero", "one", "many", "line"):
            if not isinstance(w.get(k), str) or not w.get(k): e("window needs " + k)
        if not isinstance(C.get("permissions"), dict) or not all(isinstance(v, str) and v for v in C.get("permissions", {}).values()): e("permissions name each permission with a line")
        langs = C.get("i18n") or []
        if "en" not in langs: e("i18n must include en")
        for l in langs:
            if l != "en" and not os.path.exists(os.path.join(p, "i18n", l + ".json")): e("i18n lists " + l + " but i18n/" + l + ".json is missing")
        for f in FILES:
            if not os.path.exists(os.path.join(p, f)): e("the folder has no " + f)
        out.append(C)
    seen = {}
    for C in out:
        for r in C.get("routes") or []:
            if r in seen: errs.append(C["id"] + ": route " + r + " is already served by " + seen[r])
            seen[r] = C["id"]
    out.sort(key=lambda C: (C.get("order", 99), C.get("id", "")))
    return out, errs

def files_under(base):
    for dp, dn, fn in os.walk(base):
        dn.sort()
        for f in sorted(fn): yield os.path.join(dp, f)

def version(Cs):
    h = hashlib.sha256()
    srcs = list(files_under(APP)) + [f for C in Cs for f in files_under(os.path.join(MODS, C["id"])) if f.endswith(("module.json", "screen.js")) or "/i18n/" in f]
    for f in srcs: h.update(os.path.relpath(f, REPO).encode()); h.update(rd(f, "rb"))
    return h.hexdigest()[:10]

def token_bg():
    t = rd(os.path.join(APP, "tokens.css"))
    light = re.search(r"--bg:\s*(#[0-9a-fA-F]{6})", t).group(1)
    dark = re.search(r':root\[data-theme="dark"\]\s*\{[^}]*?--bg:\s*(#[0-9a-fA-F]{6})', t, re.S).group(1)
    return light, dark

def translations(Cs):
    langs, errs = {}, []
    srcs = [("app", os.path.join(APP, "i18n"))] + [(C["id"], os.path.join(MODS, C["id"], "i18n")) for C in Cs]
    for who, d in srcs:
        if not os.path.isdir(d): continue
        for f in sorted(os.listdir(d)):
            if not f.endswith(".json"): continue
            l = f[:-5]
            try: D = json.loads(rd(os.path.join(d, f)))
            except Exception as x: errs.append(who + ": i18n/" + f + " is not valid JSON"); continue
            M = langs.setdefault(l, {})
            for k, v in D.items():
                if k in M and M[k] != v: errs.append(who + ": i18n/" + f + " translates " + repr(k) + " differently from another file")
                M[k] = v
    return langs, errs

def build(out, gen):
    Cs, errs = contracts()
    langs, e2 = translations(Cs); errs += e2
    if errs: sys.exit("The build stopped:\n  " + "\n  ".join(errs))
    V = version(Cs); bgL, bgD = token_bg()
    if os.path.isdir(out): shutil.rmtree(out)
    os.makedirs(os.path.join(out, "m")); os.makedirs(os.path.join(out, "i18n"))
    LANGS = [["en", "English"]] + [[l, LANG_NAMES.get(l, l)] for l in sorted(langs) if l != "en"]
    for f in sorted(os.listdir(APP)):
        p = os.path.join(APP, f)
        if os.path.isdir(p): continue
        ext = os.path.splitext(f)[1]
        if ext in TEXT:
            s = rd(p).replace("__V__", V).replace("__BG_LIGHT__", bgL).replace("__BG_DARK__", bgD)
            if f == "shell.js": s = re.sub(r"/\*LANGS\*/.*?/\*/LANGS\*/", "/*LANGS*/" + json.dumps(LANGS, ensure_ascii=False) + "/*/LANGS*/", s)
            open(os.path.join(out, f), "w", encoding="utf-8").write(s)
        else: shutil.copyfile(p, os.path.join(out, f))
    for f in sorted(os.listdir(os.path.join(APP, "icons"))): shutil.copyfile(os.path.join(APP, "icons", f), os.path.join(out, f))
    for C in Cs:
        s = rd(os.path.join(MODS, C["id"], "screen.js"))
        open(os.path.join(out, "m", C["id"] + ".js"), "w", encoding="utf-8").write("/* Loop Studio · module " + C["id"] + " · built from modules/" + C["id"] + "/screen.js */\n" + s)
    for l, D in sorted(langs.items()):
        if l == "en": continue
        open(os.path.join(out, "i18n", l + ".json"), "w", encoding="utf-8").write(json.dumps(D, ensure_ascii=False, sort_keys=True, indent=0))
    ident = lambda i: "m_" + i.replace("-", "_")
    js = "// Generated by dev/build.py from the folders in modules/. Edit the modules, then build; never edit this file.\n"
    js += "".join('import %s from "../../modules/%s/server.js";\n' % (ident(C["id"]), C["id"]) for C in Cs)
    js += "export const V = %s;\nexport const MODULES = [\n" % json.dumps(V)
    js += "".join("  { contract: %s, server: %s },\n" % (json.dumps(C, ensure_ascii=False, sort_keys=True), ident(C["id"])) for C in Cs)
    js += "];\n"
    open(gen, "w", encoding="utf-8").write(js)
    for f in [os.path.join(out, "shell.js"), os.path.join(out, "sw.js"), gen] + [os.path.join(out, "m", C["id"] + ".js") for C in Cs]:
        subprocess.run(["node", "--check", f], check=True)
    return V, Cs, LANGS

def same_tree(a, b):
    fa = {os.path.relpath(f, a): rd(f, "rb") for f in files_under(a)}; fb = {os.path.relpath(f, b): rd(f, "rb") for f in files_under(b)} if os.path.isdir(b) else {}
    return sorted(k for k in set(fa) | set(fb) if fa.get(k) != fb.get(k))

if __name__ == "__main__":
    if "--check" in sys.argv:
        tmp = tempfile.mkdtemp(); o, g = os.path.join(tmp, "app"), os.path.join(tmp, "registry.gen.js")
        V, Cs, _ = build(o, g)
        diff = same_tree(o, OUT) + ([] if os.path.exists(GEN) and rd(g) == rd(GEN) else ["api/_core/registry.gen.js"])
        shutil.rmtree(tmp)
        if diff: print("not current:", ", ".join(diff[:12])); sys.exit(1)
        print("current", V); sys.exit(0)
    V, Cs, LANGS = build(OUT, GEN)
    print("built", V, "·", len(Cs), "modules:", ", ".join(C["id"] for C in Cs), "·", "languages:", ", ".join(l for l, _ in LANGS))
