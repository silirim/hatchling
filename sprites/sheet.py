#!/usr/bin/env python3
"""Writes a contact sheet PNG to judge the drawings by eye: rows = things, columns = animals, each cell the adult wearing that one
thing, on the ground #1e1e2e, the thing's id next to its row in the bitmap font of cover.py. No dependencies.

  python3 sprites/sheet.py out.png [--babies] [--all] [--coats] [--only new|id,id] [--light] [--scale 6]

--babies  the baby in place of the adult        --all    the hidden animal too
--coats   rows = the coats, and the plain one   --only   those rows only; `new` is the things added last (NEW)
--light   as on a light terminal: the lighter effects, and the edge the mod draws round what is pale
"""
import argparse
from pathlib import Path

from cover import FONT, HIDE, NIGHT, SAND, load, rgb, write_png

NEW = ("balloon", "glasses", "eyepatch", "duck", "partyhat", "boots", "santa", "hoodie", "wand", "laptop", "wizard", "pastel", "terminal", "eggshell")
DAY, INK = "#fafafa", "#3c3c4c"  # the ground and the labels of --light
PALE, RIM, BRIGHT = 175, 0.6, 190  # the edge on a light terminal, as hooks/register.js draws it
GAP, TEXT = 2, 2  # empty pixels of a sprite between two cells; the scale of the labels


def pale(hx):
    r, g, b = rgb(hx)
    return min(r, g, b) > PALE or 0.299 * r + 0.587 * g + 0.114 * b > BRIGHT


def cell(zoo, animal, body, thing, coat, light):
    """One pet as pixels: {(row, column): colour}, in the body's own coordinates. A thing's marks may fall outside the body."""
    a = zoo["pack"]["animals"][animal]
    pal = {**zoo["common"], **a["palette"]}
    px = {(r, c): ch for r, row in enumerate(a["states"][body]["frames"][0]) for c, ch in enumerate(row) if ch != "."}
    if thing:
        d = zoo["pack"]["items"][thing]["draw"][animal][body]
        px.update({(d["at"][0] + r, d["at"][1] + c): ch for r, row in enumerate(d["art"]) for c, ch in enumerate(row) if ch != "."})
    tint = a["tints"].get(coat, {})
    if coat == "golden": px.update({(r, c): "x" for r, c in a["gold"][body]["shine"]})  # the glint; the sparkles come and go
    pal = {**pal, **tint, **(zoo["light"] if light else {})}
    out = {at: pal[ch] for at, ch in px.items()}
    if light:  # what is pale and touches the ground is darkened; a colour of a coat takes the coat's darkest
        edge, of = (zoo["pack"]["coats"][coat]["ramp"][0], set(tint.values())) if coat else (None, set())
        dark = lambda hx: edge if hx in of else "#%02x%02x%02x" % tuple(round(v * RIM) for v in rgb(hx))
        out = {(r, c): dark(hx) if pale(hx) and not all(n in px for n in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1))) else hx for (r, c), hx in out.items()}
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("out", type=Path)
    for flag in ("--babies", "--all", "--coats", "--light"): ap.add_argument(flag, action="store_true")
    ap.add_argument("--only", default="")
    ap.add_argument("--scale", type=int, default=6)
    o = ap.parse_args()
    zoo, animals = load()
    cols = [k for k in animals if o.all or k not in HIDE]
    body, k = "baby" if o.babies else "adult", o.scale
    rows = ["plain", *zoo["pack"]["coats"]] if o.coats else list(zoo["pack"]["items"])
    only = NEW if o.only == "new" else tuple(filter(None, o.only.split(",")))
    if only: rows = [r for r in rows if r in only]
    assert rows, "no row left: --only names nothing of this sheet"
    cells = {(i, j): cell(zoo, a, body, None if o.coats else r, r if o.coats and r != "plain" else None, o.light) for i, r in enumerate(rows) for j, a in enumerate(cols)}
    # every cell as large as the largest drawing, so the pets stand in line
    r0, r1 = min(r for px in cells.values() for r, _ in px), max(r for px in cells.values() for r, _ in px)
    c0, c1 = min(c for px in cells.values() for _, c in px), max(c for px in cells.values() for _, c in px)
    cw, ch = max((c1 - c0 + 1 + GAP) * k, (max(map(len, cols)) + 1) * 6 * TEXT), (r1 - r0 + 1 + GAP) * k  # a column holds its animal's name too
    head = 12 * TEXT
    left = max(len(r) for r in rows) * 6 * TEXT + 2 * k
    w, h = left + len(cols) * cw + k, head + len(rows) * ch + k
    ground, ink = (DAY, INK) if o.light else (NIGHT, SAND)
    img = [bytearray(rgb(ground) * w) for _ in range(h)]

    def rect(x, y, bw, bh, colour):
        for row in img[y:y + bh]: row[x * 3:(x + bw) * 3] = colour * bw

    def text(s, x, y):
        for i, glyph in enumerate(FONT.get(g, "") for g in s):
            for r, row in enumerate(glyph.split("/")):
                for c, bit in enumerate(row):
                    if bit == "#": rect(x + (i * 6 + c) * TEXT, y + r * TEXT, TEXT, TEXT, rgb(ink))

    for j, a in enumerate(cols): text(a, left + j * cw + (-c0) * k, TEXT)
    for i, r in enumerate(rows): text(r, k, head + i * ch + (ch - 9 * TEXT) // 2)
    for (i, j), px in cells.items():
        for (r, c), hx in px.items(): rect(left + j * cw + (c - c0) * k, head + i * ch + (r - r0 + GAP // 2) * k, k, k, rgb(hx))
    write_png(o.out, w, h, img)


if __name__ == "__main__":
    main()
