"""Writes assets/hatch.gif: each animal of the public pack hatching in turn, drawn from the sprites. A looping GIF89a, no dependencies."""
import struct
from cover import EDGE, FLOOR, HERE, HIDE, NIGHT, load

W, H, SCALE = 480, 400, 20
FLOOR_H, EDGE_H = 72, 4  # the floor band of the cover, in proportion
WOBBLE, CRACKED, STILL, HOP = 15, 50, 80, 20  # hundredths of a second a frame stays
LIMIT = 1_000_000  # bytes


def steps():
    """The drawings in order, as (rows, palette, hundredths of a second)."""
    zoo, animals = load()
    egg, shell = zoo["egg"]["frames"], zoo["egg"]["palette"]
    for name, (states, pal) in animals.items():
        if name in HIDE: continue
        for i in (0, 1, 2, 1) * 2: yield egg[i], shell, WOBBLE  # 1.2 s
        yield egg[3], shell, CRACKED
        yield states["baby"]["frames"][0], pal, STILL
        yield states["adult"]["frames"][0], pal, STILL
        for i in (0, 1, 0, 1): yield states["cheer"]["frames"][i], pal, HOP  # 0.8 s of the cheer: its two frames, a hop


def lzw(pixels, bits):
    """The pixels (palette indexes) as GIF's LZW, cut in sub-blocks."""
    clear, end = 1 << bits, (1 << bits) + 1
    out, acc, n = bytearray(), 0, 0
    table, free, size = {}, end + 1, bits + 1

    def emit(code):
        nonlocal acc, n
        acc |= code << n
        n += size
        while n >= 8:
            out.append(acc & 255)
            acc >>= 8
            n -= 8

    emit(clear)
    cur = pixels[0]
    for px in pixels[1:]:
        key = (cur, px)
        if key in table:
            cur = table[key]
            continue
        emit(cur)
        if free == 4096:  # the table is full: start again
            emit(clear)
            table, free, size = {}, end + 1, bits + 1
        else:
            table[key] = free
            if free == 1 << size: size += 1
            free += 1
        cur = px
    emit(cur)
    emit(end)
    if n: out.append(acc & 255)
    return b"".join(bytes([len(out[i:i + 255])]) + out[i:i + 255] for i in range(0, len(out), 255)) + b"\x00"


def unlzw(data, bits):
    """The reverse of `lzw`, for the self-check: sub-blocks already joined, to palette indexes."""
    clear, end = 1 << bits, (1 << bits) + 1
    out, acc, n, pos = bytearray(), 0, 0, 0
    table, size, prev = [], bits + 1, None
    while True:
        while n < size:
            acc |= data[pos] << n
            pos += 1
            n += 8
        code, acc, n = acc & ((1 << size) - 1), acc >> size, n - size
        if code == clear:
            table, size, prev = [bytes([i]) for i in range(clear)] + [b"", b""], bits + 1, None
        elif code == end:
            return out
        else:
            entry = table[code] if code < len(table) else table[prev] + table[prev][:1]
            out += entry
            if prev is not None and len(table) < 4096:
                table.append(table[prev] + entry[:1])
                if len(table) == 1 << size and size < 12: size += 1
            prev = code


def check(gif, frames, colours):
    """Reads the file back as a decoder would: header, palette, the loop extension, and every frame's pixels against what was drawn."""
    assert gif[:6] == b"GIF89a" and struct.unpack("<HH", gif[6:10]) == (W, H) and gif[10] & 0x80
    bits = (gif[10] & 7) + 1
    pos, loops, seen, delays = 13 + 3 * (1 << bits), False, 0, 0
    assert gif[13:13 + 3 * len(colours)] == b"".join(colours)

    def blocks(pos):
        data = bytearray()
        while gif[pos]:
            data += gif[pos + 1:pos + 1 + gif[pos]]
            pos += 1 + gif[pos]
        return data, pos + 1

    while gif[pos] != 0x3B:
        if gif[pos] == 0x21:
            label, (data, pos) = gif[pos + 1], blocks(pos + 2)
            if label == 0xFF and data[:11] == b"NETSCAPE2.0": loops = data[11] == 1 and data[12:14] == b"\x00\x00"  # repeat for ever
            if label == 0xF9: delays += struct.unpack("<H", data[1:3])[0]
        else:
            assert gif[pos] == 0x2C
            x, y, w, h, packed = struct.unpack("<HHHHB", gif[pos + 1:pos + 10])
            assert not packed and x + w <= W and y + h <= H
            data, pos = blocks(pos + 11)
            assert unlzw(data, gif[pos - len(data) - (len(data) + 254) // 255 - 2]) == frames[seen][1], f"frame {seen} reads back different"
            seen += 1
    assert pos == len(gif) - 1 and loops and seen == len(frames) and len(gif) < LIMIT
    return f"self-check: GIF89a {W}x{H}, {len(colours)} colours in a global palette of {1 << bits}, {seen} frames read back equal to the drawing, {delays / 100:.1f} s a loop, loops for ever, {len(gif)} bytes (under {LIMIT})"


def main():
    rgb = lambda hx: bytes.fromhex(hx[1:])
    colours = [rgb(NIGHT), rgb(FLOOR), rgb(EDGE)]
    index = lambda hx: colours.index(rgb(hx)) if rgb(hx) in colours else (colours.append(rgb(hx)) or len(colours) - 1)
    floor = H - FLOOR_H
    ground = [bytearray([1 if y >= floor + EDGE_H else 2 if y >= floor else 0]) * W for y in range(H)]
    # every drawing is redrawn in one box: the widest and tallest frame, centred, standing on the floor
    todo = list(steps())
    bw, bh = max(len(rows[0]) for rows, _, _ in todo) * SCALE, max(len(rows) for rows, _, _ in todo) * SCALE
    bx, by = (W - bw) // 2, floor - bh
    assert bx >= 0 and by >= 0
    frames = []  # (x, y, w, h), pixels, delay
    for n, (rows, pal, delay) in enumerate(todo):
        img = [bytearray(r) for r in ground]
        x0, y0 = (W - len(rows[0]) * SCALE) // 2, floor - len(rows) * SCALE
        for r, row in enumerate(rows):
            for c, ch in enumerate(row):
                if ch != ".":
                    for line in img[y0 + r * SCALE:y0 + (r + 1) * SCALE]:
                        line[x0 + c * SCALE:x0 + (c + 1) * SCALE] = bytes([index(pal[ch])]) * SCALE
        box = (0, 0, W, H) if n == 0 else (bx, by, bw, bh)  # the first frame lays the ground, the others redraw the box
        frames.append((box, b"".join(bytes(line[box[0]:box[0] + box[2]]) for line in img[box[1]:box[1] + box[3]]), delay))

    bits = max(2, (len(colours) - 1).bit_length())
    assert len(colours) <= 256
    gif = bytearray(b"GIF89a" + struct.pack("<HHBBB", W, H, 0x80 | (bits - 1) << 4 | (bits - 1), 0, 0))
    gif += b"".join(colours) + bytes(3 * ((1 << bits) - len(colours)))
    gif += b"\x21\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00"  # repeat for ever
    for box, pixels, delay in frames:
        gif += b"\x21\xF9\x04\x04" + struct.pack("<H", delay) + b"\x00\x00"  # leave the frame in place
        gif += b"\x2C" + struct.pack("<HHHHB", *box, 0) + bytes([bits]) + lzw(pixels, bits)
    gif += b"\x3B"
    out = HERE.parent / "assets" / "hatch.gif"
    out.parent.mkdir(exist_ok=True)
    out.write_bytes(gif)
    print(out)
    print(check(bytes(gif), frames, colours))


if __name__ == "__main__":
    main()
