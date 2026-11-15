"""Writes assets/cover.png: the egg and every animal of the public pack, 1280x640, no dependencies."""
import json, struct, zlib
from pathlib import Path

HERE = Path(__file__).parent
HIDE = ("axolotl",)  # ids of animals of the pack left out of the cover and of hatch.gif
W, H, MARGIN = 1280, 640, 80
MIN_GAP = 8  # px between sprites, at least
NIGHT, FLOOR, EDGE, STAR, SAND = "#1e1e2e", "#27273a", "#8d4325", "#ffd54f", "#efe9dc"
FLOOR_H, EDGE_H = 115, 6
TITLE, SUBTITLE = ("Which one hatches for you?", 196, 7), ("Cachito · a pixel pet for Claude Code", 292, 4)  # text, y, scale
STARS = [(120, 70, 5), (250, 130, 10), (390, 50, 10), (520, 110, 5), (650, 150, 5), (760, 60, 10), (880, 120, 5), (1000, 45, 5), (1090, 140, 10), (1180, 80, 5)]  # x, y, size

# 5 px wide pixel font; rows 8 and 9 are descenders. Only the glyphs the cover needs.
FONT = {
    "W": "#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#",
    "C": ".###./#...#/#..../#..../#..../#...#/.###.",
    "a": "/.../.###./....#/.####/#...#/.####",
    "c": "/.../.###./#..../#..../#...#/.###.",
    "d": "....#/....#/.##.#/#..##/#...#/#...#/.####",
    "e": "/.../.###./#...#/#####/#..../.###.",
    "f": "..##./.#..#/.#.../###../.#.../.#.../.#...",
    "h": "#..../#..../#.##./##..#/#...#/#...#/#...#",
    "i": "..#../...../.##../..#../..#../..#../.###.",
    "l": ".##../..#../..#../..#../..#../..#../.###.",
    "n": "/.../#.##./##..#/#...#/#...#/#...#",
    "o": "/.../.###./#...#/#...#/#...#/.###.",
    "p": "/.../####./#...#/#...#/#...#/####./#..../#....",
    "r": "/.../#.##./##..#/#..../#..../#....",
    "s": "/.../.####/#..../.###./....#/####.",
    "t": ".#.../.#.../###../.#.../.#.../.#..#/..##.",
    "u": "/.../#...#/#...#/#...#/#..##/.##.#",
    "x": "/.../#...#/.#.#./..#../.#.#./#...#",
    "y": "/.../#...#/#...#/#...#/#..##/.##.#/....#/.###.",
    "?": ".###./#...#/....#/...#./..#../...../..#..",
    "·": "/.../.../.../..#..",
    " ": "",
}

rgb = lambda hx: bytes.fromhex(hx[1:])


def load():
    """zoo.json, and the animals of its public pack in pack order: id -> (states, palette)."""
    zoo = json.loads((HERE / "zoo.json").read_text())
    return zoo, {k: (a["states"], {**zoo["common"], **a["palette"]}) for k, a in zoo["pack"]["animals"].items()}


def write_png(out, w, h, rows):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    raw = b"".join(b"\x00" + bytes(r) for r in rows)  # filter: none
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    out.parent.mkdir(exist_ok=True)
    out.write_bytes(png)
    print(out, f"{w}x{h}", f"{len(png)} bytes")


def main():
    img = [bytearray(rgb(NIGHT) * W) for _ in range(H)]

    def rect(x, y, w, h, colour):
        assert 0 <= x and x + w <= W and 0 <= y and y + h <= H
        for row in img[y:y + h]:
            row[x * 3:(x + w) * 3] = colour * w

    def text(s, x, y, scale):
        for i, ch in enumerate(s):
            for r, row in enumerate(FONT[ch].split("/")):
                for c, bit in enumerate(row):
                    if bit == "#":
                        rect(x + (i * 6 + c) * scale, y + r * scale, scale, scale, rgb(SAND))
        return x, y, (len(s) * 6 - 1) * scale, 9 * scale  # the box it takes, descenders included

    def sprite(rows, pal, x, bottom):
        while not rows[-1].strip("."):  # stand on the floor: drop empty rows under the feet
            rows = rows[:-1]
        for r, row in enumerate(rows):
            for c, ch in enumerate(row):
                if ch != ".":
                    rect(x + c * scale, bottom - (len(rows) - r) * scale, scale, scale, rgb(pal[ch]))

    zoo, animals = load()
    row = [(zoo["egg"]["frames"][0], zoo["egg"]["palette"])]
    row += [(states["adult"]["frames"][0], pal) for k, (states, pal) in animals.items() if k not in HIDE]
    assert all(len(r) == zoo["width"] for rows, _ in row for r in rows)
    # the largest whole scale at which the row fits between the margins, then the row spread over that width
    room, n = W - 2 * MARGIN, len(row)
    scale = (room - (n - 1) * MIN_GAP) // (n * zoo["width"])
    cell = zoo["width"] * scale
    gap = min((room - n * cell) // (n - 1), 2 * scale)
    left = (W - n * cell - (n - 1) * gap) // 2

    floor = H - FLOOR_H
    rect(0, floor, W, FLOOR_H, rgb(FLOOR))
    rect(0, floor, W, EDGE_H, rgb(EDGE))
    boxes = [text(s, left, y, k) for s, y, k in (TITLE, SUBTITLE)]
    assert all(x + w <= W - MARGIN for x, _, w, _ in boxes) and boxes[1][1] + boxes[1][3] < floor - zoo["height"] * scale
    for x, y, size in STARS:
        assert not any(x < bx + bw and bx < x + size and y < by + bh and by < y + size for bx, by, bw, bh in boxes), "a star behind the text"
        rect(x, y, size, size, rgb(STAR))
    for i, (rows, pal) in enumerate(row):
        sprite(rows, pal, left + i * (cell + gap), floor)
    write_png(HERE.parent / "assets" / "cover.png", W, H, img)


if __name__ == "__main__":
    main()
