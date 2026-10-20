# Loop Studio · each module's own checks (modules/<id>/test.py), run in turn with the shared harness and the module's
# contract. A module that cannot be imported, or whose checks stop early, fails here by name.
import importlib.util, json, os, sys, traceback
import harness as h

base = os.path.join(h.REPO, "modules")
ids = sorted(d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d)) and not d.startswith((".", "_")))
for i in ids:
    C = json.load(open(os.path.join(base, i, "module.json")))
    try:
        spec = importlib.util.spec_from_file_location("mt_" + i.replace("-", "_"), os.path.join(base, i, C["tests"]))
        m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        n0 = len(h.R); m.run(h, C)
        h.ok(i + ": its checks ran", len(h.R) - n0 >= 3, len(h.R) - n0)
    except Exception as e:
        traceback.print_exc(); h.ok(i + ": its checks ran", False, repr(e))
h.summary()
