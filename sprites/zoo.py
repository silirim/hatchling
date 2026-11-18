#!/usr/bin/env python3
"""Builds the pets: the animals, each with the same set of states.

One adult and one baby are drawn by hand per animal (12x10 pixels, 5 terminal rows).
The other states are derived from the adult with shared rules (sad eyes, sweat drop,
halo...) so that a new animal costs two drawings. `OVERRIDE` holds hand-made exceptions.
Effect states use a 14x12 canvas: one spare column each side and two rows above the head.
Output: zoo.json, and zoo.js because a Claude Code mod can only import JS modules. What is drawn here leaves as a skin pack
(`pack`, the format of docs/skins.md, the one a person's own packs have), so the format is proven by the real drawings:
engine/skins.js checks and reads it like any other pack.
"""
import json
import os

W, H = 12, 10
FW, FH = 14, 12  # effect canvas
SIDE = 8  # columns an item may take next to the body, each side
UNDER = 2  # rows an item may take under the feet: the adapter makes the frame that much taller
COMMON = {"k": "#1b1b1b", "W": "#f5f5f5", "r": "#f48fb1",                    # eyes, white, cheeks
          "y": "#ffd54f", "K": "#ffb300", "S": "#263238", "h": "#d4a056", "M": "#43a047", "w": "#81d4fa", "v": "#ab47bc", "R": "#ef5350",      # sparkle/crown, water, dizzy eyes, alarm
          "u": "#42a5f5", "n": "#795548", "N": "#4e342e", "q": "#26c6da", "i": "#eceff1",      # shop items: blue, brown, a sole's darker brown, cyan, white
          "x": "#fff6cf",                                                      # the glint on a golden coat
          "z": "#f4e3b8", "Z": "#a9793f"}                                      # a warm cream and its shade: the eggshell of 0.3.4, kept for the packs drawn with them
FIXED = "kyvwRKShMunNqixzZ"
LIGHT = {"y": "#f9a825", "K": "#e68a00", "w": "#29b6f6"}  # light terminals: the pale effects would vanish. White and what is as pale get a darker edge, drawn by the adapter
SCARF = {"penguin": 5, "chick": 6, "cactus": 6}  # row of the adult's neck, 7 when not listed
# the shop's items, in its order: the part each is worn on and its English name (engine/engine.js SHOP has the same, a test compares them)
ITEMS = {"shades": ("face", "sunglasses"), "mug": ("accessory", "a coffee mug"), "balloon": ("accessory", "a balloon"), "glasses": ("face", "round glasses"),
         "eyepatch": ("face", "an eye patch"), "duck": ("accessory", "a rubber duck"), "partyhat": ("head", "a party hat"), "scarf": ("body", "a red scarf"),
         "cap": ("head", "a travel cap"), "sneakers": ("feet", "sneakers"), "boots": ("feet", "boots"), "lamp": ("accessory", "a desk lamp"),
         "santa": ("head", "a Santa hat"), "headphones": ("head", "headphones"), "hoodie": ("body", "a hoodie"), "backpack": ("accessory", "a backpack"),
         "wand": ("accessory", "a magic wand"), "skateboard": ("feet", "a skateboard"), "suitcase": ("accessory", "a suitcase"), "laptop": ("accessory", "a laptop"),
         "sombrero": ("head", "a sombrero"), "wizard": ("head", "a wizard's hat"),
         "goldenegg": ("accessory", "a golden egg")}  # the last one is not sold: the founder's keepsake (engine/engine.js GOLDENEGG)
WEAR = list(ITEMS)

# name: (rarity weight, own palette, adult, adult eyes, adult cheeks, skin behind a closed eye, baby, baby eyes)
ZOO = {
    "penguin": (10, {"B": "#37474f", "o": "#ffa726", "a": "#90a4ae"},
                ["...BBBBBB...", "..BBBBBBBB..", ".BBWWBBWWBB.", ".BWkWWWWkWB.", ".BWrWooWrWB.", "BBWWWWWWWWBB", "BBWWWWWWWWBB", ".BWWWWWWWWB.", "..BBWWWWBB..", "..oo....oo.."],
                [(3, 3), (3, 8)], [(4, 3), (4, 8)], "W",
                ["............", "............", "....aaaa....", "...aaaaaa...", "..aWWaaWWa..", "..akWWWWka..", "..arWooWra..", "..aWWWWWWa..", "...aaWWaa...", "...oo..oo..."],
                [(5, 3), (5, 8)]),
    "chick": (10, {"c": "#ffd54f", "o": "#fb8c00"},
              [".....cc.....", "...cccccc...", "..cccccccc..", ".cckcccckcc.", ".crccooccrc.", "cccccccccccc", "cccccccccccc", ".cccccccccc.", "..cccccccc..", "...oo..oo..."],
              [(3, 3), (3, 8)], [(4, 2), (4, 9)], "c",
              ["............", "............", "............", "....cccc....", "...cccccc...", "...ckcckc...", "...ccoocc...", "..WccccccW..", "..WWWWWWWW..", "...WWWWWW..."],
              [(5, 4), (5, 7)]),
    "dog": (10, {"t": "#e0b07a", "E": "#8d5a2b"},
            [".EE......EE.", "EEEttttttEEE", "EEttttttttEE", "EEtkttttktEE", ".EttWWWWttE.", ".ttWWkkWWtt.", ".ttWWrrWWtt.", "..tttttttt..", "..tttttttt..", "..tt....tt.."],
            [(3, 3), (3, 8)], [], "t",
            ["............", "............", "............", "..EE....EE..", "..EttttttE..", "..EkttttkE..", "...tWkkWt...", "...tWrrWt...", "...tttttt...", "...tt..tt..."],
            [(5, 3), (5, 8)]),
    "bunny": (10, {},
              ["..WW....WW..", "..WrW..WrW..", "..WrW..WrW..", "..WWWWWWWW..", ".WWWWWWWWWW.", ".WkWWWWWWkW.", ".WrWWrrWWrW.", ".WWWWWWWWWW.", "..WWWWWWWW..", "..WW....WW.."],
              [(5, 2), (5, 9)], [(6, 2), (6, 9)], "W",
              ["............", "............", "...WW..WW...", "...Wr..rW...", "...WWWWWW...", "..WWWWWWWW..", "..WkWWWWkW..", "..WWWrrWWW..", "...WWWWWW...", "...WW..WW..."],
              [(6, 3), (6, 8)]),
    "fox": (10, {"o": "#f57c00"},
            ["oo........oo", "ooo......ooo", "oooooooooooo", "oooooooooooo", "ookooooookoo", "WWWooooooWWW", ".WWWWkkWWWW.", "..WWWWWWWW..", "...oooooo...", "...oo..oo..."],
            [(4, 2), (4, 9)], [], "o",
            ["............", "............", "............", "..o......o..", "..oo....oo..", "..oooooooo..", "..okooooko..", "..WWWkkWWW..", "...WWWWWW...", "...oo..oo..."],
            [(6, 3), (6, 8)]),
    "cactus": (10, {"G": "#1e6e1e", "g": "#4caf50", "L": "#d4f0a8", "P": "#8d4325", "p": "#cc6a28"},
               ["...GGGGGG...", "...GkggkG...", "G..GrggrG..G", "Gg.GgkkgG.gG", "GgGGggggGGgG", ".GGGgLggGGG.", "...GggggG...", "..PPPPPPPP..", "..pppppppp..", "...pppppp..."],
               [(1, 4), (1, 7)], [(2, 4), (2, 7)], "g",
               ["............", ".....LL.....", "....GGGG....", "...GkggkG...", ".G.GrggrG.G.", ".GGGgkkgGGG.", "...GggggG...", "..PPPPPPPP..", "..pppppppp..", "...pppppp..."],
               [(3, 4), (3, 7)]),
    # rare, about 2%
    "axolotl": (1.2, {"P": "#f8bbd0", "m": "#ec407a"},
                ["............", "m..........m", ".m.PPPPPP.m.", "m.PPPPPPPP.m", ".mPkPPPPkPm.", "m.PrPPPPrP.m", "..PPkPPkPP..", "..PPPkkPPP..", "...PPPPPP...", "...PP..PP..."],
                [(4, 3), (4, 8)], [(5, 3), (5, 8)], "P",
                ["............", "............", "............", "............", "..m......m..", "...mPPPPm...", "..mPkPPkPm..", "...PPkkPP...", "...PPPPPP...", "....P..P...."],
                [(6, 4), (6, 7)]),
}

# state -> frames drawn by hand for one animal, replacing the derived ones
OVERRIDE = {}


# The egg a pet is born from, shown once at the first start: the same for every animal, so the hatching is a surprise.
_EGG = [
    "............",
    "....WWWW....",
    "...WWWWWW...",
    "..WWWhWWWW..",
    "..WWWWWWWW..",
    "..WWWWWhWW..",
    "..WhWWWWWW..",
    "..WWWWWWWW..",
    "...WWWWWW...",
    "....WWWW....",
]
_CRACK = _EGG[:4] + ["..WWkWWWkW..", "..WkWkWkWk..", "..kWWWkWWW.."] + _EGG[7:]
EGG = [_EGG, [r[1:] + "." for r in _EGG], ["." + r[:-1] for r in _EGG], _CRACK]

def grid(rows): return [list(r) for r in rows]
def rows(g): return ["".join(r) for r in g]


def put(g, r, c, ch, only_empty=False):
    if 0 <= r < len(g) and 0 <= c < len(g[0]) and (not only_empty or g[r][c] == "."):
        g[r][c] = ch


def inward(c): return c + 1 if c < W / 2 else c - 1


def blink(base, eyes, skin):
    g = grid(base)
    for r, c in eyes: g[r][c] = skin
    return rows(g)


def crown(base):
    """Spiked, darker gold, red gems, resting on the head: must not read as the KO halo (thin, pale, floating)."""
    top = min(r for r in range(H) if base[r][5:7] != "..")  # head top at the centre, ears ignored
    g = canvas(base)
    for i, ch in enumerate("K.KK.K"): put(g, top, 4 + i, ch) if ch != "." else None
    for i, ch in enumerate("KKRRKK"): put(g, top + 1, 4 + i, ch)
    return rows(g)


def art(pic, r, c):
    """A small drawing as marks: its rows top to bottom, its top left corner at (r, c), `.` for nothing."""
    return [(r + i, c + j, ch) for i, row in enumerate(pic) for j, ch in enumerate(row) if ch != "."]


# The accessories, from the desk and the trip: one full colour and one detail, big enough to be told at a glance. They stand on the
# ground next to the pet, outside its 12 columns: the adapter widens the frame by what they need.
MUG = ["..i...", ".i....", "..i...", "......", "qqqq..", "qqqqq.", "qyyq.q", "qqqqq.", "qqqq.."]  # steam, a yellow band, the handle. Cyan: the scarf and the headphones are red
LAMP = [".yyy.", "yyyyy", "yyyyy", "KKKKK", "..h..", "..h..", "..h..", ".hhh."]  # the lit shade with its rim, the arm, the foot
BACKPACK = ["..MM..", ".M..M.", ".MMMM.", "MMMMMM", "MKKKKM", "MMKKMM", "MMMMMM", "MMMMMM"]  # the loop on top, the flap and its buckle
SUITCASE = ["..nnn..", "..n.n..", "nnnnnnn", "KKKKKKK", "nnnnnnn", "nnnnnnn"]  # the handle and a strap round it
BALLOON = [".RRR.", "RiRRR", "RRRRR", ".RRR.", "..R..", "..i..", ".i...", "..i..", "..i..", ".i..."]  # its shine, the knot, the string down to the ground
DUCK = ["...yy.", "...ykK", "y.yyy.", "yyyyy.", ".yyy.."]  # looking right: the eye, the beak, the tail up
WAND = ["..y..", ".yxy.", "..y..", "..i..", ".i...", ".i...", "i...."]  # the star with its pale heart, the stick leaning
GOLDENEGG = ["..yy..", ".yxyy.", "yxyyyK", "yxyyyK", "yyyyKK", "yyyKKK", ".KKKK."]  # the founder's keepsake: small and whole, narrower at its top, the gold of the crown, the golden coat's glint on its upper left, amber down its right and under it. No new colour: a pack may use any key that is not shared
LAPTOP = ["iiiiii.", "iqSSSi.", "iSqqSi.", "iiiiii.", "iiiiiii"]  # open: two lines of text on a dark screen, the base a pixel longer
# the hats that sit on the head: two rows above it and one over its top row
PARTYHAT = ["..yy..", ".qvqv.", "vqvqvq"]  # a striped cone, its tip yellow
SANTA = ["..RRRR.", ".RRRRRi", "iiiiii."]  # leaning to the right, the bobble at its end, the white trim
WIZARD = ["....vv..", "..vyvv..", "vvvvvvvv"]  # the bent tip, a star, the wide brim
RING = [(a, b) for a in (-1, 0, 1) for b in (-1, 0, 1) if a or b]
HEM = {"cactus": 0}  # rows the hoodie goes down from the neck when not to the feet: the cactus keeps its pot
HOOD = {"cactus": {"adult": 3, "baby": 4}}  # the last row of the head, for the hood, when the rows down to the neck are not all head
STRAP = {"penguin": {"adult": "h"}, "cactus": {"adult": "h", "baby": "h"}}  # the eye patch's strap on a dark head, where the dark one is lost


def feet(base):
    """The columns of each foot. A body with one base in place of two feet (a pot, a shell) has one at each end of it."""
    cols = [c for c in range(W) if base[H - 1][c] != "."]
    runs = [[c for c in cols if c < W // 2], [c for c in cols if c >= W // 2]]
    if cols == list(range(cols[0], cols[-1] + 1)): runs = [cols[:2], cols[-2:]]
    return runs


def shoes(base):
    """Sneakers, on the row of the feet only, so they never reach the face: each foot purple with a white toe pointing out."""
    runs = feet(base)
    return [(H - 1, c, "v") for run in runs for c in run] + [(H - 1, runs[0][0] - 1, "i"), (H - 1, runs[1][-1] + 1, "i")]


def boots(base):
    """Boots, the suitcase's brown: the leg up each foot, three rows tall where the face ends high enough, else two, and under it a
    darker sole with the toe pointing out. A body on one base (a pot) has them under it: two short boots it stands in."""
    runs = feet(base)
    if "." not in base[H - 1].strip("."):  # one base, no two feet
        return [(H, c, "n") for run in runs for c in run] + [(H + 1, c, "N") for c in [runs[0][0] - 1, *runs[0], *runs[1], runs[1][-1] + 1]]
    face = max(r for r in range(H) if set(base[r]) & set("kr"))
    tall = 3 if H - 3 > face else 2
    return [(r, c, "n") for run in runs for c in run for r in range(H - tall, H - 1)] + [(H - 1, c, "N") for c in [runs[0][0] - 1, *runs[0], *runs[1], runs[1][-1] + 1]]


def wear(base, eyes, neck, hem=H - 2, head=None, strap="S"):
    """Each shop item on one body (the adult or the baby), as marks (row, column, colour) in the body's own 12x10 coordinates.
    Rows above 0 fall on the effect canvas; columns outside 0..11 widen the frame (the adapter pads it), so one set of marks serves
    every state drawn from that body. Nothing that stands against the background is dark: it would vanish on a dark terminal.
    Things worn follow the head, the eyes, the neck and the feet; the accessories stand on the ground next to the feet.
    The skateboard lies under the feet, on two rows below the body: the adapter makes the frame taller for it."""
    top = min(r for r in range(H) if base[r][5:7] != "..")
    r0, lo, hi = eyes[0][0], min(c for _, c in eyes), max(c for _, c in eyes)
    span = lambda r: [c for c in range(W) if base[r][c] != "."]
    n, ear = span(neck), span(r0)
    # headphones: a cup two wide and three tall on each side of the head at the eyes, and a band one pixel thin: straight up from
    # each cup, one step in, and over the top of the head, in front of the ears. Never along the outline, which made a wide arc
    left, right = ear[0], ear[-1]
    band = [(top - 1, c, "u") for c in range(left + 2, right - 1)] + [(r, c, "u") for c in (left, right) for r in range(top + 1, r0 - 1)]
    band += [(top, c, "u") for c in (left + 1, right - 1) if top < r0 - 1]
    cups = [(r, c, "R") for r in range(r0 - 1, r0 + 2) for c in (left - 1, left, right, right + 1)]
    inside = lambda r, c: 0 <= r < H and 0 <= c < W and base[r][c] != "."
    # round glasses: a brown frame round each eye, a pixel on each of its four sides, so the eye, which is black, is seen in the middle,
    # and the bridge between the two. Eyes too close for two frames get a simpler pair: a rim at each side of each eye and one under it.
    # Never a pixel outside the body: nothing above the head
    close = hi - lo < 5
    rims = [(r + a, c + b, "n") for r, c in eyes for a, b in (((1, 0), (0, -1), (0, 1)) if close else RING)] + [(r0, c, "n") for c in range(lo + 2, hi - 1)]
    rims = [m for m in rims if inside(m[0], m[1])]
    # the eye patch: dark, so on the body only. Over the eye on the right and the pixel under it, two wide, and its strap over the head
    # to the other side, in `strap`: a colour that shows on that head
    out = hi + 1 if inside(r0, hi + 1) else hi - 1
    patch = [(r0 - 1, c, strap) for c in span(r0 - 1) if c < min(hi, out)] + [(r, c, "S") for r in (r0, r0 + 1) for c in (hi, out) if inside(r, c)]
    # the hoodie: from the neck down to the feet, with two white strings when it is two rows tall, and its hood up: a line of its
    # colour round the top and the sides of the head, outside it, so behind the ears, which stay in front. `head` is the last row
    # of the head when it is not the one above the neck. Every mark of it is above the neck: with a hat on the mod leaves those out
    low = min(max(hem, neck), H - 2)
    hoodie = [(r, c, "u") for r in range(neck, low + 1) for c in span(r)]
    if low > neck: hoodie += [(neck + 1, c, "i") for c in (4, 7) if inside(neck + 1, c)]
    mid = lambda r: [c for c in span(r) if all(inside(r, x) for x in range(min(c, 5), max(c, 6) + 1))]  # the head: what joins the centre, not an arm
    skull = {(r, c) for r in range(top, (neck - 1 if head is None else head) + 1) for c in mid(r)}
    hoodie += sorted({(r + a, c + b, "u") for r, c in skull for a, b in ((-1, 0), (0, -1), (0, 1)) if not inside(r + a, c + b) and r + a < neck})
    beside = max(W + 1, right + 3)  # one empty column between a thing on the right and the body, and between it and a cup of the headphones
    marks = {
        "shades": [(r0, c, "S") for c in range(lo, hi + 1)],
        "mug": art(MUG, H - len(MUG), beside),
        "balloon": art(BALLOON, H - len(BALLOON), -len(BALLOON[0]) - 1),
        "glasses": rims,
        "eyepatch": patch,
        "duck": art(DUCK, H - len(DUCK), beside),
        "partyhat": art(PARTYHAT, top - 2, 3),
        "boots": boots(base),
        "santa": art(SANTA, top - 2, 3),
        "hoodie": hoodie,
        "wand": art(WAND, H - 1 - len(WAND), beside),  # held up: a pixel off the ground
        "laptop": art(LAPTOP, H - len(LAPTOP), W + 1),
        "wizard": art(WIZARD, top - 2, 2),
        "scarf": [(neck, c, "R") for c in n] + [(neck + 1, n[0] + 2, "R")],
        "sneakers": shoes(base),
        "cap": [(top - 2, 5, "u"), (top - 2, 6, "u")] + [(top - 1, c, "u") for c in range(4, 8)] + [(top - 1, 8, "R"), (top - 1, 9, "R")],  # the peak to the right
        "lamp": art(LAMP, H - len(LAMP), -len(LAMP[0]) - 1),
        "headphones": band + cups,
        "backpack": art(BACKPACK, H - len(BACKPACK), -len(BACKPACK[0]) - 1),
        "suitcase": art(SUITCASE, H - len(SUITCASE), W),
        "skateboard": [(H, c, "v") for c in range(W)] + [(H + 1, c, "K") for c in (2, 3, 8, 9)],  # the deck as wide as the body, two wheels
        "sombrero": [(top - 2, c, "R") for c in range(4, 8)] + [(top - 1, c, "h") for c in range(1, 11)],
        "goldenegg": art(GOLDENEGG, H - len(GOLDENEGG), beside),
    }
    return {k: marks[k] for k in WEAR}


def sad(base, eyes, cheeks, skin):
    """Crying: a stream of tears under each eye."""
    g = grid(base)
    for r, c in cheeks: g[r][c] = skin
    for r, c in eyes: g[r + 1][c] = g[r + 2][c] = "w"
    return rows(g)


def bloated(base, eyes, cheeks):
    """Puffed up: one pixel wider each side from the eyes down, cheeks doubled. Drawn on the effect canvas."""
    g = canvas(base)
    for r in range(min(r for r, _ in eyes), H - 1):
        cols = [c for c in range(W) if base[r][c] != "."]
        if cols: g[r + 2][cols[0]], g[r + 2][cols[-1] + 2] = base[r][cols[0]], base[r][cols[-1]]
    for r, c in cheeks: g[r + 2][2 * c - inward(c) + 1] = "r"
    return g


def canvas(base, dr=2, dc=1):
    """The animal on the effect canvas, moved by (dr, dc)."""
    g = [["."] * FW for _ in range(FH)]
    for r, row in enumerate(base):
        for c, ch in enumerate(row):
            if ch != ".": put(g, r + dr, c + dc, ch)
    return g


def fx(base, marks, dr=2, dc=1):
    g = canvas(base, dr, dc)
    for r, c, ch in marks: put(g, r, c, ch)
    return rows(g)


def derive(adult, eyes, cheeks, skin):
    """The states drawn from the adult. `at` is where the body's corner sits on the effect canvas in each frame (the first also stands
    for the frames after it): what the adapter needs to draw a shop item over the state. Asleep the grown pet is curled up and wears nothing (the baby: `young`).
    The crown is drawn here, as a state: the adapter shows it while the crown is what the head has on."""
    plain = grid(adult)
    for r, c in cheeks: plain[r][c] = skin
    wide = [r[:] for r in plain]
    for r, c in eyes: wide[r + 1][c] = "k"  # eyes two pixels tall: alarmed
    swirl = [r[:] for r in plain]
    for r, c in eyes: swirl[r][c] = "v"
    dash = [r[:] for r in plain]
    for r, c in eyes: dash[r][inward(c)] = "k"  # eyes as a dash: out cold
    shut = [r[:] for r in grid(adult)]
    for r, c in eyes: shut[r][inward(c)] = "k"
    top = min(r for r, _ in eyes)
    squat = rows(shut)
    squat = squat[:top - 1] + squat[top:7] + squat[8:] if top > 1 else squat[:top + 1] + squat[top + 2:7] + squat[8:]  # two rows shorter: curled up
    out = {
        "adult": {"at": [(2, 1)], "frames": [adult], "rare": [blink(adult, eyes, skin)]},
        "crown": {"at": [(2, 1)], "frames": [crown(adult)], "rare": [blink(crown(adult), eyes, skin)]},
        "sad": {"at": [(2, 1)], "frames": [sad(adult, eyes, cheeks, skin)], "rare": []},
        "bloated": {"at": [(2, 1)], "frames": [rows(bloated(adult, eyes, cheeks))], "rare": []},
        "cheer": {"at": [(2, 1), (1, 1)], "frames": [fx(adult, [(1, 0, "y"), (3, 13, "y")]), fx(adult, [(3, 0, "y"), (0, 13, "y")], dr=1)], "rare": []},
        "dizzy": {"at": [(2, 0), (2, 2)], "frames": [fx(rows(swirl), [(0, 3, "y"), (1, 10, "y")], dc=0), fx(rows(swirl), [(0, 10, "y"), (1, 3, "y")], dc=2)], "rare": []},
        "stomach": {"at": [(2, 1)], "tint": "sick", "frames": [fx(rows(plain), [(1, 13, "w")]), fx(rows(plain), [(3, 13, "w")])], "rare": []},
        "loop": {"at": [(2, 1)], "frames": [fx(rows(wide), [(0, 13, "R"), (1, 13, "R"), (3, 13, "R")]), fx(rows(wide), [])], "rare": []},
        "ko": {"at": [(2, 1)], "tint": "ghost", "frames": [fx(rows(dash), [(0, c, "y") for c in range(5, 9)]), fx(rows(dash), [(1, c, "y") for c in range(5, 9)])], "rare": []},
        # the Zs are not drawn here: the adapter sets them to the right of the head, on columns of their own, so sleep takes no row above it
        "sleep": {"frames": [fx(squat, [], dr=4), fx(squat, [], dr=4)], "rare": []},
    }
    return out


def young(baby, eyes):
    """The moods and the sleep of the baby, drawn from the baby as `derive` draws the adult's from the adult: a pet not yet grown is
    itself in every mood. Asleep it is not curled up, only its eyes are shut, so it keeps what it wears (`at`)."""
    base = grid(baby)
    wide, swirl, shut = [r[:] for r in base], [r[:] for r in base], [r[:] for r in base]
    for r, c in eyes: wide[r + 1][c] = "k"; swirl[r][c] = "v"; shut[r][inward(c)] = "k"
    return {
        "baby-bloated": {"at": [(2, 1)], "frames": [rows(bloated(baby, eyes, []))], "rare": []},
        "baby-cheer": {"at": [(2, 1), (1, 1)], "frames": [fx(baby, [(1, 0, "y"), (3, 13, "y")]), fx(baby, [(3, 0, "y"), (0, 13, "y")], dr=1)], "rare": []},
        "baby-dizzy": {"at": [(2, 0), (2, 2)], "frames": [fx(rows(swirl), [(0, 3, "y"), (1, 10, "y")], dc=0), fx(rows(swirl), [(0, 10, "y"), (1, 3, "y")], dc=2)], "rare": []},
        "baby-stomach": {"at": [(2, 1)], "tint": "sick", "frames": [fx(baby, [(1, 13, "w")]), fx(baby, [(3, 13, "w")])], "rare": []},
        "baby-loop": {"at": [(2, 1)], "frames": [fx(rows(wide), [(0, 13, "R"), (1, 13, "R"), (3, 13, "R")]), fx(rows(wide), [])], "rare": []},
        "baby-sleep": {"at": [(2, 1)], "frames": [fx(rows(shut), []), fx(rows(shut), [])], "rare": []},
    }


def look(base, eyes, dr, dc):
    """The eyes moved one pixel: each goes where it looks when that pixel is inside the body, not on its edge. None when no eye can move."""
    g, moved = grid(base), 0
    body = lambda r, c: 0 <= r < H and 0 <= c < W and base[r][c] not in ".k"
    for r, c in eyes:
        nr, nc = r + dr, c + dc
        if body(nr, nc) and body(nr + dr, nc + dc):
            fill = base[r][c - 1] if base[r][c - 1] not in ".k" else base[r][c + 1]  # the skin next to the eye takes its place
            g[r][c], g[nr][nc], moved = fill, "k", moved + 1
    return rows(g) if moved else None  # an eye at the edge of a small face stays: the other one glances


def ears(base):
    """What sticks out above the head (ears, gills): the one on the right folds down by a pixel. None for a round head."""
    top = min(r for r in range(H) if base[r][5:7] != "..")
    if top == 0 or not any(base[r][c] != "." for r in range(top) for c in range(W // 2, W)): return None
    g = grid(base)
    for c in range(W // 2, W):
        for r in range(top): g[r][c] = base[r - 1][c] if r else "."  # each column of it a pixel lower: its tip is gone
    return rows(g)


def flap(base):
    """No ears: the outermost pixels of the sides (wing tips, flippers, arms) go up by one. None when the body does not reach the sides."""
    if not any(base[r][0] != "." for r in range(1, H - 1)) or base[0][0] != ".": return None
    g = grid(base)
    for c in (0, W - 1):
        for r in range(H - 1): g[r][c] = base[r + 1][c] if r + 1 < H - 1 else "."
    return rows(g)


def idle(base, eyes, dress=None):
    """The small gestures of a calm pet, each a few frames of half a second with where the body sits in each: a look to the left
    (towards the chat), to the right, up, a flick of the ears (or of the wings, flippers or arms of who has no ears), a hop of one
    pixel. A gesture the body cannot make is left out. `dress` draws the same body's state from it (the crown)."""
    on = lambda f: rows(canvas(f)) if dress is None else dress(f)  # on the effect canvas: every frame of a gesture is as big, the hop too
    out = {}
    for name, (dr, dc), n in (("left", (0, -1), 3), ("right", (0, 1), 3), ("up", (-1, 0), 2)):
        f = look(base, eyes, dr, dc)
        if f: out[name] = {"at": [(2, 1)], "frames": [on(f)] * n}
    f = ears(base) or flap(base)
    if f: out["ears"] = {"at": [(2, 1)], "frames": [on(f), on(base), on(f)]}
    up = on(base)
    if up[0].strip(".") == "": out["hop"] = {"at": [(1, 1)], "frames": [up[1:] + [up[0]]]}  # a crown on a head that reaches the top leaves no row to hop into
    return out


def gold(base):
    """Where the golden coat shows on one body: `shine`, two pixels of glint on its upper left, inside it; `spark`, the spots next
    to it where a sparkle may light up, one pixel clear of the body, on the effect canvas (rows from -2, columns from -1)."""
    # sorted: with two colours as frequent, the order of a set changes from one run to the next
    main = max(sorted(set("".join(base)) - set(".kr"), reverse=True), key="".join(base).count)
    inside = lambda r, c: 0 < r < H - 1 and 0 < c < W - 1 and all(base[r + a][c + b] != "." for a, b in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)))
    cells = [(r, c) for r in range(H) for c in range(W // 2) if base[r][c] == main and inside(r, c)]
    r, c = min(cells, key=lambda rc: rc[0] * 2 + rc[1])
    second = [(a, b) for a, b in ((r + 1, c - 1), (r, c + 1)) if base[a][b] == main][:1]  # down to the left, as light falls; else beside it
    body = [(r, c) for r in range(H) for c in range(W) if base[r][c] != "."]
    far = lambda r, c: min(max(abs(r - a), abs(c - b)) for a, b in body)
    free = [(r, c) for r in range(-2, H - 2) for c in range(-1, W + 1) if far(r, c) == 2]
    top = min(a for a, _ in body)
    want = [(top - 1, 1), (top - 1, W - 2), (top + 3, -1), (top + 3, W)]  # over each shoulder and at each side
    spark = []
    for wr, wc in want:
        best = min((x for x in free if x not in spark), key=lambda x: (x[0] - wr) ** 2 + (x[1] - wc) ** 2)
        spark.append(best)
    return {"shine": [(r, c)] + second, "spark": spark}


# The golden coat. Not one dark tint over everything: a bright yellow gold in three tones, and each animal keeps what makes it that
# animal in a tone that stands apart (GILT). `ZONES` names the pixels of a body that take another tone under the coat: a shadow under
# the body and at its sides, the tips of the ears. Each zone is a colour key of its own, the same colour as its base until gilded,
# so every state drawn from the body carries it.
PALE_GOLD, GOLD, SHADE = "#ffec8a", "#ffcb14", "#f09a00"  # light, the gold itself, its shadow: amber, never brown
ROSY = "#ff9e80"  # the cheeks under the coat


def zone(spec):
    """Cells from `row:cols`, a column or a range each: "8:2-9 9:2-3,8-9"."""
    out = []
    for part in spec.split():
        r, cs = part.split(":")
        for c in cs.split(","):
            a, _, b = c.partition("-")
            out += [(int(r), x) for x in range(int(a), int(b or a) + 1)]
    return out


# animal: [(zone key, the colour key it is cut from, the adult's cells, the baby's cells)]
ZONES = {
    "penguin": [("1", "B", "5:0,11 6:0,11 7:1,10 8:2-3,8-9", ""), ("2", "a", "", "7:2,9 8:3-4,7-8"), ("3", "o", "9:2-3,8-9", "9:3-4,7-8")],  # 3: the feet, the beak's colour
    "chick": [("1", "c", "6:0,11 7:1-2,9-10 8:2-9", "7:3-8"), ("2", "c", "0:5-6 1:3-4", "3:4-5"), ("3", "o", "9:3-4,7-8", "")],
    "dog": [("1", "t", "8:2-9 9:2-3,8-9", "9:3-4,7-8")],
    "bunny": [("1", "W", "7:1,10 8:2-9 9:2-3,8-9", "8:3,8 9:3-4,7-8"), ("2", "W", "0:2-3,8-9", "2:3-4,7-8"), ("3", "r", "6:5-6", "7:5-6")],  # 3: its nose, the cheeks' pink
    "fox": [("1", "o", "8:3-8 9:3-4,7-8", "9:3-4,7-8"), ("2", "o", "0:0-1,10-11", "3:2,9")],
    "axolotl": [("1", "P", "8:3-8 9:3-4,7-8", "8:3,8 9:4,7")],
}
# animal: its colour keys under the coat. A key not named keeps its colour: a white belly or muzzle, a beak, the pot, the gills
GILT = {
    "penguin": {"B": GOLD, "a": GOLD, "1": SHADE, "2": SHADE},
    "chick": {"c": GOLD, "1": SHADE, "2": PALE_GOLD},
    "dog": {"t": GOLD, "E": SHADE, "1": SHADE},
    "bunny": {"W": GOLD, "1": SHADE, "2": PALE_GOLD},
    "fox": {"o": GOLD, "1": SHADE, "2": PALE_GOLD},
    "cactus": {"g": GOLD, "G": SHADE, "L": PALE_GOLD},
    "axolotl": {"P": GOLD, "1": SHADE},
}


# The two plain coats: colours only, no glint and no sparkle, and nobody is born with one. As with gold each animal is told its
# tones by hand, so the face stays readable: the eyes are dark, and sit on a light tone in both.
PINK, DEEP_PINK, SKY, DEEP_SKY = "#f9b9d4", "#ee93b8", "#aee0fa", "#82c4ec"  # pastel: soft pink and light blue, each with its shadow
PASTEL_RAMP = ["#d184b0", PINK, SKY]
PASTEL = {
    "penguin": {"B": SKY, "a": SKY, "1": DEEP_SKY, "2": DEEP_SKY, "o": DEEP_PINK},
    "chick": {"c": PINK, "1": DEEP_PINK, "2": SKY, "o": DEEP_SKY},
    "dog": {"t": PINK, "E": DEEP_SKY, "1": DEEP_PINK},
    "bunny": {"W": SKY, "1": DEEP_SKY, "2": PINK},
    "fox": {"o": PINK, "1": DEEP_PINK, "2": SKY},
    "cactus": {"g": SKY, "G": DEEP_SKY, "L": PINK, "P": DEEP_PINK, "p": PINK},
    "axolotl": {"P": SKY, "1": DEEP_SKY, "m": DEEP_PINK},
}
DIM, PHOSPHOR, GLOW = "#157a36", "#2ed158", "#8cffa8"  # terminal: an old monitor's green, in three strengths
TERMINAL_RAMP = [DIM, PHOSPHOR, GLOW]
INK = COMMON["k"]  # a nose, a mouth: as dark as the eyes, where the plain animal has them dark too
# The eyes are one pixel each, in a colour next to the ground's: they show only on the lightest tone, with nothing else as dark near
# them. So the penguin's and the chick's faces are GLOW, cheeks included, and their beaks DIM: an INK beak, two pixels wide between
# the eyes, was all the face one saw. The chick has no belly to be light, so its whole body is, and its tuft and its shell are darker.
TERMINAL = {  # the lightest on the belly and the muzzle; the cheeks are light or the body's, never dark: a dark cheek reads as an eye
    "penguin": {"B": PHOSPHOR, "a": PHOSPHOR, "1": DIM, "2": DIM, "W": GLOW, "o": DIM, "3": DIM, "r": GLOW},
    "chick": {"c": GLOW, "1": PHOSPHOR, "2": DIM, "W": PHOSPHOR, "o": DIM, "3": DIM, "r": GLOW},
    "dog": {"t": PHOSPHOR, "E": DIM, "1": DIM, "W": GLOW, "r": INK},
    "bunny": {"W": PHOSPHOR, "1": DIM, "2": GLOW, "r": GLOW, "3": INK},
    "fox": {"o": PHOSPHOR, "1": DIM, "2": GLOW, "W": GLOW},
    "cactus": {"g": PHOSPHOR, "G": DIM, "L": GLOW, "P": DIM, "p": PHOSPHOR, "r": PHOSPHOR},
    "axolotl": {"P": PHOSPHOR, "1": DIM, "m": GLOW, "r": GLOW},
}
# the coats in the shop's order, cheapest first: id -> (English name, ramp for an animal with no tint of its own, the tints drawn here)
COATS = {"pastel": ("a pastel coat", PASTEL_RAMP, PASTEL), "terminal": ("a terminal coat", TERMINAL_RAMP, TERMINAL),
         "golden": ("a golden coat", [SHADE, GOLD, PALE_GOLD], None)}


def zoned(name, own, adult, baby):
    """The two bodies with their zones cut in, and the palette with a key for each."""
    own, bodies = dict(own), [grid(adult), grid(baby)]
    for key, base, *cells in ZONES.get(name, []):
        own[key] = (COMMON | own)[base]
        for g, spec in zip(bodies, cells):
            for r, c in zone(spec):
                assert g[r][c] == base, (name, key, r, c, g[r][c])
                g[r][c] = key
    return own, rows(bodies[0]), rows(bodies[1])


def mix(a, b, t):
    pa, pb = [int(a[i:i + 2], 16) for i in (1, 3, 5)], [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return "#%02x%02x%02x" % tuple(round(x + (y - x) * t) for x, y in zip(pa, pb))


def grey(a):
    r, g, b = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    v = round((0.3 * r + 0.59 * g + 0.11 * b) * 0.6 + 70)
    return "#%02x%02x%02x" % (v, v, v)


def art_of(marks):
    """Marks as the small drawing a pack holds: where its top left corner is, and its rows."""
    cells = {(r, c): ch for r, c, ch in marks}
    r0, c0 = min(r for r, _ in cells), min(c for _, c in cells)
    return {"at": [r0, c0], "art": ["".join(cells.get((r, c), ".") for c in range(c0, max(c for _, c in cells) + 1)) for r in range(r0, max(r for r, _ in cells) + 1)]}


def fallbacks():
    """Each shop item for an animal it has no drawing for (one from a pack): pieces set by the animal's anchors, see docs/skins.md."""
    piece = lambda anchor, art, dx=0, dy=0: {"anchor": anchor, "art": art, **({"dx": dx} if dx else {}), **({"dy": dy} if dy else {})}
    made = {
        "shades": [piece("face", ["SSSSSS"])],
        "mug": [piece("right", MUG)],
        "scarf": [piece("neck", ["RRRRRRRR", "..R....."])],
        "cap": [piece("head", [".uu...", "uuuuRR"], 1)],
        "sneakers": [piece("feet", ["ivv..vvi"])],
        "lamp": [piece("left", LAMP)],
        "headphones": [piece("face", ["RR..........RR"] * 3), piece("head", ["uuuuuuuuuu"])],
        "backpack": [piece("left", BACKPACK)],
        "skateboard": [piece("under", ["v" * W, "..KK....KK.."])],
        "suitcase": [piece("right", SUITCASE)],
        "sombrero": [piece("head", ["...RRRR...", "hhhhhhhhhh"])],
        "balloon": [piece("left", BALLOON)],
        "glasses": [piece("face", [".n....n.", "n.nnnn.n", ".n....n."])],
        "eyepatch": [piece("face", ["hhhhhh..", "......SS", "......SS"], 0, 1)],
        "duck": [piece("right", DUCK)],
        "partyhat": [piece("head", PARTYHAT, 0, 1)],
        "boots": [piece("feet", [".nn..nn.", "NNN..NNN"])],
        "santa": [piece("head", SANTA, 0, 1)],
        "hoodie": [piece("neck", ["uuuuuuuu", "uuiuuiuu"])],
        "goldenegg": [piece("right", GOLDENEGG)],
        "wand": [piece("right", WAND, 0, -1)],
        "laptop": [piece("right", LAPTOP)],
        "wizard": [piece("head", WIZARD, 0, 1)],
    }
    return {k: made[k] for k in WEAR}


def animal(name, spec, gilt=None):
    """One animal as a pack holds it, and how its two bodies wear each shop item."""
    weight, own, adult, eyes, cheeks, skin, baby, baby_eyes = spec
    own, adult, baby = zoned(name, own, adult, baby)
    pal = {**COMMON, **own}
    states = {"baby": {"at": [(2, 1)], "frames": [baby], "rare": [blink(baby, baby_eyes, skin)]}, **derive(adult, eyes, cheeks, skin), **young(baby, baby_eyes)}
    # the calm states move a little now and then: the gestures of each body, the crowned one's drawn with its crown
    states["baby"]["idle"], states["adult"]["idle"], states["crown"]["idle"] = idle(baby, baby_eyes), idle(adult, eyes), idle(adult, eyes, crown)
    # the items on each body; the baby's neck is under its face, which takes most of it
    necks = {"adult": SCARF.get(name, 7), "baby": min(baby_eyes[0][0] + 3, 8)}
    hem = {body: neck + HEM[name] if name in HEM else H - 2 for body, neck in necks.items()}
    items = {body: wear(base, look, necks[body], hem[body], HOOD.get(name, {}).get(body), STRAP.get(name, {}).get(body, "S")) for body, base, look in (("adult", adult, eyes), ("baby", baby, baby_eyes))}
    for body in items.values():
        assert list(body) == WEAR and all(ch in FIXED for marks in body.values() for _, _, ch in marks) and all(-2 <= r < H + UNDER and -SIDE <= c < W + SIDE for marks in body.values() for r, c, _ in marks), name
    for st, frames in OVERRIDE.get(name, {}).items(): states[st]["frames"] = frames
    for st, v in states.items():
        for f in v["frames"] + v["rare"] + [f for g in v.get("idle", {}).values() for f in g["frames"]]:
            assert len({len(r) for r in f}) == 1 and len(f) % 2 == 0 and set("".join(f)) <= set(pal) | {"."}, (name, st)
    tintable = {k: v for k, v in pal.items() if k not in FIXED}
    top = lambda base: min(r for r in range(H) if base[r][5:7] != "..")
    return {
        "name": {"en": name}, **({"weight": weight} if weight else {}), "palette": own,
        # where the things of a pack go on this body: the top of the head, the eyes, the neck
        "anchors": {"adult": {"top": top(adult), "eyes": eyes, "neck": necks["adult"]}, "baby": {"top": top(baby), "eyes": baby_eyes, "neck": necks["baby"]}},
        "states": states,
        "gold": {"adult": gold(adult), "baby": gold(baby)},
        # the cheeks stay rosy under the coat; what GILT does not name keeps its colour
        "tints": {"sick": {k: mix(v, "#9ccc65", 0.45) for k, v in tintable.items()}, "ghost": {k: grey(v) for k, v in tintable.items()},
                  **{coat: tints[name] for coat, (_, _, tints) in COATS.items() if tints and name in tints},
                  "golden": {"r": ROSY, **(gilt or GILT[name])}},
    }, {body: {k: art_of(marks) for k, marks in worn.items()} for body, worn in items.items()}


def main():
    animals, fall = {}, fallbacks()
    items = {k: {"part": part, "name": {"en": en}, "draw": {}, "fallback": fall[k]} for k, (part, en) in ITEMS.items()}
    for name, spec in ZOO.items():
        animals[name], worn = animal(name, spec)
        for k in WEAR: items[k]["draw"][name] = {body: worn[body][k] for body in worn}
    out = {"width": W, "height": H, "side": SIDE, "under": UNDER, "common": COMMON, "fixed": FIXED, "light": LIGHT,
           "egg": {"palette": {"W": COMMON["W"], "h": "#d4a056", "k": COMMON["k"]}, "frames": EGG},  # whole, leaning left, leaning right, cracked
           # a coat is a ramp of colours, dark to light, for an animal with no tint of its own for it; on a light theme its first colour is the edge
           "pack": {"format": 1, "id": "hatchling", "name": "Hatchling", "animals": animals, "items": items,
                    "coats": {coat: {"name": {"en": en}, "ramp": ramp} for coat, (en, ramp, _) in COATS.items()}}}
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "zoo")
    with open(base + ".json", "w") as fh:
        json.dump(out, fh, indent=1)
    with open(base + ".js", "w") as fh:
        fh.write("// generated by sprites/zoo.py, do not edit\nexport default " + json.dumps(out, separators=(",", ":")) + "\n")
    print(base + ".js", len(animals), "animals,", sum(len(v["frames"]) + len(v["rare"]) for s in animals.values() for v in s["states"].values()), "frames")


if __name__ == "__main__":
    main()
