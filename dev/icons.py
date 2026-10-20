#!/usr/bin/env python3
# Loop Studio · the app icons, drawn from tokens.css (the accent and its ink), so a new design system redraws them in
# one run. The mark is a placeholder until the Loop design system sets its own: an open loop with a bead in its gap.
# Usage: python3 dev/icons.py   (writes app/icons/*.png; then python3 dev/build.py)
import math, os, re
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(HERE)
TOK = open(os.path.join(REPO, "app", "tokens.css"), encoding="utf-8").read()
root = TOK[TOK.index(":root {"):TOK.index("@media (prefers-color-scheme: dark)")]
tok = lambda n: re.search(r"--" + n + r":\s*(#[0-9a-fA-F]{6})", root).group(1)
hexrgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
BG, INK = hexrgb(tok("accent")), hexrgb(tok("accent-ink"))

def draw(size, pad):
    S = size * 4  # drawn large, then reduced, for smooth edges
    im = Image.new("RGB", (S, S), BG); d = ImageDraw.Draw(im)
    u = (S * (1 - 2 * pad)) / 48.0; o = S * pad
    P = lambda x, y: (o + x * u, o + y * u)
    cx, cy, r, w = 24, 24, 17, 4.2
    a0, a1 = 0.0, math.degrees(math.atan2(9.6 - 24, 33.5 - 24)) % 360  # the open loop: from 3 o'clock round to the gap
    box = [P(cx - r - w / 2, cy - r - w / 2), P(cx + r + w / 2, cy + r + w / 2)]
    d.arc(box, start=a0, end=a1, fill=INK, width=round(w * u))
    for ang in (a0, a1):  # round ends
        x, y = cx + r * math.cos(math.radians(ang)), cy + r * math.sin(math.radians(ang)); (X, Y) = P(x, y); rr = w / 2 * u
        d.ellipse([X - rr, Y - rr, X + rr, Y + rr], fill=INK)
    (X, Y) = P(38.6, 14.2); rr = 3.4 * u
    d.ellipse([X - rr, Y - rr, X + rr, Y + rr], fill=INK)
    return im.resize((size, size), Image.LANCZOS)

OUT = os.path.join(REPO, "app", "icons"); os.makedirs(OUT, exist_ok=True)
for name, size, pad in [("icon-180.png", 180, .2), ("icon-192.png", 192, .2), ("icon-512.png", 512, .2), ("icon-mask.png", 512, .28)]:
    draw(size, pad).save(os.path.join(OUT, name), optimize=True)
print("icons written to app/icons from accent", tok("accent"))
