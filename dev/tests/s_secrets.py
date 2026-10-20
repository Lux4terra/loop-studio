# Loop Studio · the secret scan: nothing in the repo looks like a real key, token or password, and the test values
# used by the local mock are plainly test values. Run on every commit before main, and in every board review.
import os, re, subprocess
from harness import *

PATTERNS = {
    "GitHub token": r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b",
    "Anthropic key": r"\bsk-ant-[A-Za-z0-9_-]{20,}",
    "OpenAI-style key": r"\bsk-(?:proj-)?[A-Za-z0-9]{32,}",
    "Google API key": r"\bAIza[0-9A-Za-z_-]{35}\b",
    "Groq key": r"\bgsk_[A-Za-z0-9]{40,}\b",
    "AWS key": r"\bAKIA[0-9A-Z]{16}\b",
    "Slack token": r"\bxox[abprs]-[A-Za-z0-9-]{10,}",
    "Private key": r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----",
    "Vercel token": r"\bvercel_[A-Za-z0-9]{24,}\b",
    "a secret given a value": r"(?i)\b(?:STUDIO_KEY|LOOP_GITHUB_TOKEN|OPS_SECRET|ADMIN_PASSWORD|API_KEY|SECRET)\s*[=:]\s*[\"']?(?!test-|\$|process\.env|E\.|\{|<)[A-Za-z0-9_\-+/]{12,}",
}
TEST_VALUES = {"test-studio-key-0123456789", "test-data-token", "loop-pass-2026"}
tracked = subprocess.run(["git", "-C", REPO, "ls-files", "--cached", "--others", "--exclude-standard"], capture_output=True, text=True).stdout.split()
hits, scanned = [], 0
for f in tracked:
    p = os.path.join(REPO, f)
    if not os.path.isfile(p) or f.endswith((".png", ".jpg", ".ico")): continue
    s = open(p, encoding="utf-8", errors="replace").read(); scanned += 1
    for name, rx in PATTERNS.items():
        for m in re.finditer(rx, s): hits.append("%s: %s (%s…)" % (f, name, m.group(0)[:12]))
ok("the scan reads every file in the repo", scanned >= 40, scanned)
ok("no key, token or password is written in the repo", not hits, hits[:8])
# the scan catches what it should
probe = "LOOP_GITHUB_TOKEN=github_pat_" + "A1b2C3d4E5f6G7h8I9j0" * 3 + "\nghp_" + "x" * 36 + "\nSTUDIO_KEY=sUp3r-s3cret-value-abc"
ok("the scan itself catches a planted token and key", sum(len(re.findall(rx, probe)) for rx in PATTERNS.values()) >= 3, "")
dev = open(os.path.join(HERE, "devserver.mjs")).read()
ok("the local mock runs on test values only", all(v in dev + open(os.path.join(HERE, "harness.py")).read() for v in TEST_VALUES) and "test values only" in dev, "")
ok("the keys are read from Vercel's environment, never from a file", all(("E." + k) in open(os.path.join(REPO, "api", "_core", f)).read() for k, f in [("STUDIO_KEY", "auth.js"), ("LOOP_GITHUB_TOKEN", "store.js"), ("LOOP_DATA_REPO", "store.js")]), "")
ok("no environment file is in the repo", not [f for f in tracked if re.search(r"(^|/)\.env", f)], [f for f in tracked if ".env" in f])
summary()
