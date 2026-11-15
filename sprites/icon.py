"""Writes .claude-plugin/icon.png: the adult cactus of the public pack, 512 px, no dependencies."""
from cover import HERE, load, write_png

SIZE, SCALE, BG = 512, 40, (0x1E, 0x1E, 0x2E)

states, palette = load()[1]["cactus"]
rows = states["adult"]["frames"][0]
pal = {k: tuple(bytes.fromhex(v[1:])) for k, v in palette.items()}
w, h = len(rows[0]) * SCALE, len(rows) * SCALE
assert w <= SIZE and h <= SIZE
ox, oy = (SIZE - w) // 2, (SIZE - h) // 2

img = []
for y in range(SIZE):
    line = bytearray()
    for x in range(SIZE):
        r, c = (y - oy) // SCALE, (x - ox) // SCALE
        ch = rows[r][c] if 0 <= r < len(rows) and 0 <= c < len(rows[0]) else "."
        line += bytes(pal.get(ch, BG))
    img.append(line)
write_png(HERE.parent / ".claude-plugin" / "icon.png", SIZE, SIZE, img)
