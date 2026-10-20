#!/usr/bin/env python3
# Loop Studio · every English string a person can read, gathered for translators into dev/i18n/strings.json.
# English is the key: a translation file is { "English text": "translated text" } in app/i18n/<lang>.json, or in
# modules/<id>/i18n/<lang>.json for a module's own words. The build merges them; the shell's t() reads them.
# Usage: python3 dev/i18n/extract.py            write strings.json and print how many
#        python3 dev/i18n/extract.py --missing fr   list strings with no French yet
import json, os, re, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
rd = lambda p: open(p, encoding="utf-8").read()
STR = r'"((?:[^"\\]|\\.)+)"'

def calls(s, names):
    """the text inside each call to one of names(...), with nested brackets kept whole"""
    for m in re.finditer(r'(?<![\w.])(?:' + "|".join(re.escape(n) for n in names) + r')\(', s):
        i, d = m.end(), 1
        while i < len(s) and d:
            d += {"(": 1, ")": -1}.get(s[i], 0); i += 1
        yield s[m.end():i - 1]

words = lambda x: x[:1].isupper() or " " in x  # a sentence or a label, not a code word

def from_js(s):
    out = set()
    for arg in calls(s, ["t", "T", "ctx.t", "ctx.T"]):
        whole = re.fullmatch(r'\s*' + STR + r'\s*', arg)  # a call holding one string is always words, whatever its case
        out |= {whole.group(1)} if whole else {x for x in re.findall(STR, arg) if words(x)}
    out |= {x for x in re.findall(r'\["[\w-]*",\s*' + STR + r'\]', s) if words(x) or x[:1].isdigit()}  # labels in seg([...]) choices
    for name in ("MN", "DN"):
        m = re.search(r'const ' + name + r' = \[(.*?)\];', s)
        if m: out |= set(re.findall(STR, m.group(1)))
    for m in re.finditer(r'const \w+_L = \{(.*?)\};', s): out |= set(re.findall(r':\s*' + STR, m.group(1)))
    for arg in calls(s, ["plural"]): out |= {x for x in re.findall(STR, arg) if words(x)}
    for m in re.finditer(r'\b(?:name|lede|line|title):\s*' + STR, s): out.add(m.group(1))
    m = re.search(r'const greet = .*', s)
    if m: out |= set(re.findall(STR, m.group(0)))
    return out

def from_server(s):
    out = set(re.findall(r'[{,]\s*error:\s*' + STR, s)) | set(re.findall(r'fail\(\d+,\s*' + STR + r'\)', s))
    for m in re.finditer(r'notify\(\{[^}]*\}', s): out |= set(re.findall(r'\b[tx]:\s*' + STR, m.group(0)))
    return out

def gather():
    S = set()
    S |= from_js(rd(os.path.join(REPO, "app", "shell.js")))
    for f in glob.glob(os.path.join(REPO, "modules", "*", "screen.js")): S |= from_js(rd(f))
    for f in [os.path.join(REPO, "api", "studio.js")] + glob.glob(os.path.join(REPO, "api", "_core", "*.js")) + glob.glob(os.path.join(REPO, "modules", "*", "server.js")): S |= from_server(rd(f))
    for f in glob.glob(os.path.join(REPO, "modules", "*", "module.json")):
        C = json.loads(rd(f)); S |= {C["name"], C["summary"]} | {a["what"] for a in C["actions"]} | {v for v in C["window"].values()}
    return sorted(x.replace('\\"', '"') for x in S if re.search(r"[A-Za-z]", x) and not x.startswith(("studio/", "#")))

if __name__ == "__main__":
    S = gather()
    if "--missing" in sys.argv:
        l = sys.argv[sys.argv.index("--missing") + 1]; have = {}
        for f in glob.glob(os.path.join(REPO, "app", "i18n", l + ".json")) + glob.glob(os.path.join(REPO, "modules", "*", "i18n", l + ".json")): have.update(json.loads(rd(f)))
        miss = [s for s in S if s not in have]; print("\n".join(miss)); print(len(miss), "of", len(S), "missing for", l); sys.exit(0)
    json.dump(S, open(os.path.join(HERE, "strings.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(S), "strings written to dev/i18n/strings.json")
