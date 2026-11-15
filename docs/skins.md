# Skin packs

A skin pack adds animals, things to wear and coats to Cachito. It is one JSON file that you put in a folder of your own:

```
~/.claude/cachito-skins/<any-name>.json
```

(If you run Claude Code with `CLAUDE_CONFIG_DIR`, the folder is `$CLAUDE_CONFIG_DIR/cachito-skins/`.)

A pack is **data, never code**. Cachito reads the file, checks every field of it, and only then draws from it. Nothing in a pack is
run, and a pack cannot change what the pet does, what it costs or what it sends anywhere.

- What a pack brings is **yours at once**: you installed it. It costs no stars and gives none.
- Its things show in the skin menu and `/pet skin`, its animals in `/pet animal`, each with the pack's name after it.
- A pack with **one fault is left out whole**, and `/pet skins` says what is wrong and where. A broken pack never breaks the band.
- An animal from a pack is never rolled at birth. Take the pack away and a pet shown as one of its animals goes back to the animal
  it was born as; put the pack back and it returns.
- Under the bench (`CACHITO_BENCH`) no pack is read.

The drawings Cachito ships with (`sprites/zoo.js`, the `pack` field) are a pack in this same format, checked by the same code.
It is the largest example there is.

## Try one

1. Copy [`skins-example.json`](skins-example.json) (the example below) to `~/.claude/cachito-skins/example.json`.
2. Check it outside Claude Code, from a clone of this repository: `npm run skin:check ~/.claude/cachito-skins/example.json`.
   It prints what the pack brings, or every fault, with the same rules the mod uses. It ends with 1 for a pack that would be left out.
3. In Claude Code run `/pet skins`. The folder is read again each time, so there is no restart after an edit.
4. `/pet animal robot`, `/pet wear tophat`, `/pet wear mint`. `/pet wear plain` takes a coat off.

## A complete, minimal pack

One animal with one drawing, one hat, one coat:

```json
{
  "format": 1,
  "id": "example",
  "name": "Example",
  "animals": {
    "robot": {
      "name": { "en": "robot", "es": "robot" },
      "palette": { "B": "#90a4ae", "D": "#546e7a" },
      "states": {
        "adult": {
          "frames": [[
            "....DDDD....",
            "..BBBBBBBB..",
            ".BBBBBBBBBB.",
            ".BBkBBBBkBB.",
            ".BBBBBBBBBB.",
            ".BBBDDDDBBB.",
            "..BBBBBBBB..",
            "..DBBBBBBD..",
            "..BBBBBBBB..",
            "..DD....DD.."
          ]]
        }
      }
    }
  },
  "items": {
    "tophat": {
      "part": "head",
      "name": { "en": "a top hat" },
      "fallback": [{ "anchor": "head", "art": [".uuuu.", ".RRRR.", "uuuuuu"] }]
    }
  },
  "coats": {
    "mint": { "name": { "en": "a mint coat" }, "ramp": ["#00796b", "#4db6ac", "#b2dfdb"] }
  }
}
```

## The format, version 1

```
{
  "format": 1,                  required, this number
  "id": "example",              required: 2 to 24 of a-z 0-9 -, a letter first
  "name": "Example",            required: shown after everything the pack brings, 1 to 32 characters
  "credits": { "author": "...", "license": "...", "source": "..." },    optional texts, up to 160 characters each:
                                who made what the pack holds, under which licence, where it comes from. /pet skins shows them
  "animals": { "<name>": Animal },    up to 8
  "items":   { "<name>": Item },      up to 24
  "coats":   { "<name>": Coat }       up to 8
}
```

A pack must bring at least one thing. A field that is not listed here is a fault: a typo is told, not ignored.

**Names** (of animals, items and coats) follow the rule of `id`. A name may not be one Cachito ships (`fox`, `mug`, `golden`…),
a word the commands use (`none`, `off`, `plain`, `nohead`, `crown`, `animal`, `coat`, `head`, `face`, `body`, `feet`,
`accessory`, `cachito`, `constructor`, `prototype`), a name used twice in the pack, or a name a pack read before took. Packs are read in the order of their
file names; the later one with a taken name is left out.

**Texts** (`name`, and each language of a `name` object): 1 to 32 characters, no space at the ends, no control, invisible
or unassigned characters, no two spaces in a row, at most three combining marks on a character. A `name` object is `{ "en": "...", "es": "...", "pt": "...", "zh": "..." }`; `en` is required and stands in for a
language that is missing.

**Colours** are written `#rrggbb`.

### Pixels

A drawing is a list of rows of text, one character a pixel: `.` is nothing, any other character is a colour key.
The body is 12 pixels wide and 10 tall. Two pixel rows make one row of the terminal.

Every animal can use these shared colours:

| key | colour | | key | colour |
| --- | --- | --- | --- | --- |
| `k` | eyes, near black | | `M` | green |
| `W` | white | | `w` | water blue |
| `r` | rosy cheeks | | `v` | purple |
| `y` | yellow | | `R` | red |
| `K` | amber | | `u` | blue |
| `S` | dark slate | | `n` | brown |
| `h` | tan | | `q` | cyan |
| `i` | off-white | | `x` | pale glint |
| `N` | dark brown | | | |

All of them but `W` and `r` are **fixed**: a tint or a coat never changes them. Things to wear are drawn with the fixed colours
only, so a hat looks the same on every animal and under every coat.

### Animal

```
{
  "name": { "en": "robot" },                 required
  "palette": { "B": "#90a4ae" },             required: the animal's own colours, one letter or digit each, up to 24,
                                             none of the shared keys
  "states": { "adult": State, ... },         required, with at least "adult"
  "size": [20, 22],                          the body's width and height in pixels when it is not 12 by 10: even numbers, 8 to 24
  "anchors": { "adult": Anchors, "baby": Anchors },
  "tints": { "<tint or coat name>": { "B": "#..." } },
  "gold": { "adult": Glint, "baby": Glint },
  "wear": { "<item name>": { "adult": Drawing, "baby": Drawing } }
}
```

**States.** `baby`, `adult`, `crown` are the three stages of growth. `sleep` is the pet asleep. `cheer`, `dizzy`, `stomach`,
`loop`, `bloated`, `sad`, `ko` are moods (`/pet demo` shows the ones in use). A state you do not draw is drawn as `adult`.

```
State = {
  "frames": [Frame, ...],       1 to 8; a mood with more than one is animated, two frames a second
  "rare":   [Frame, ...],       up to 4: shown now and then in place of the first frame (a blink)
  "at":     [[2, 1], ...],      where the body's top left corner sits in each frame; the first stands for the rest
  "tint":   "sick",             a tint of this animal to colour the state with
  "idle":   { "<gesture>": { "frames": [...], "at": [...] } }     baby, adult, crown only: up to 8 small gestures
}
```

A `Frame` is either 10 rows of 12 pixels (the body alone) or 12 rows of 14 (one spare column each side and two rows above the
head, for sparkles, a hop, a halo). An animal with its own `size` of w by h draws its frames w by h, or w+2 by h+2. `at` says where the body is on the larger one, row then column, each 0 to 2; the smaller
frame always sits at `[2, 1]`, which is also the default. Things to wear are drawn from `at`, so they follow the body when it
moves. `sleep` has no `at`: asleep the pet wears nothing.

**Anchors** tell where things go on a body that the thing's pack never saw:

```
Anchors = { "top": 0, "eyes": [[3, 3], [3, 8]], "neck": 6 }
```

`top` is the row where the head starts at its centre, `eyes` the two eyes as `[row, column]`, `neck` the row of a scarf.
Without them Cachito looks at the drawing: the first row filled at the centre, the first pixels of colour `k`, three rows under them.

**Tints** recolour the animal's own colours (and `W`, `r`): `"tints": { "sick": { "B": "#a0b090" } }` for a state's `tint`,
or under a coat's name for how this animal looks with that coat on (`"golden"` for the shipped golden coat). An animal without
a tint for a coat gets the coat's ramp instead.

**Glint** is for the golden coat: `{ "shine": [[2, 3], [3, 2]], "spark": [[-1, 1], [-1, 10], [3, -1], [3, 12]] }`. `shine`
is up to 4 pale pixels on the body, `spark` up to 4 spots next to it where a sparkle lights up (rows -2 to 9, columns -1 to 12).

**wear** draws by hand how this animal's bodies wear a thing, a shipped one or another pack's. See `Drawing` below.

### Item

```
{
  "part": "head",                            required: head, face, body, feet or accessory
  "name": { "en": "a top hat" },             required
  "fallback": [Piece, ...],                  required, 1 to 4: how any animal wears it
  "draw": { "<animal name>": { "adult": Drawing, "baby": Drawing } }
}
```

One thing is worn on each part at a time. An `accessory` stands on the ground next to the pet.

A **Piece** is a small drawing set by the animal's anchors, so it fits animals the pack does not know:

```
Piece = { "anchor": "head", "art": [".uuuu.", ".RRRR.", "uuuuuu"], "dx": 0, "dy": 0 }
```

| anchor | where the art goes |
| --- | --- |
| `head` | its last row right over the top of the head, centred between the eyes |
| `face` | its middle row on the row of the eyes, centred between them |
| `neck` | its first row on the neck, centred between the eyes |
| `feet` | its last row on the row of the feet, centred on the body |
| `under` | under the feet, centred on the body: the frame grows taller (up to 2 rows) |
| `left`, `right` | on the ground at that side, one empty column from the body: the frame grows wider |

`art` is 1 to 12 rows of 1 to 16 pixels, all as long, in the fixed colours. `dx` and `dy` move it, -8 to 8. Pixels that fall
out of reach of the frame are left out.

A **Drawing** places the art by hand on one body, for an animal you know:

```
Drawing = { "at": [-2, 3], "art": ["uuuuuu"] }
```

`at` is the row and column of the art's top left corner in the body's own 12 by 10: row 0 is the body's first row, negative
rows are above the head (down to -2), rows 10 and 11 are under the feet, columns run from -8 to 19. All of the art must fit.

Which drawing is used for an item on an animal: the item's `draw` for that animal, else the animal's `wear` for that item,
else the item's `fallback`.

A thing of the `body` drawn above the animal's `neck` (a hood) gives way to a hat: while a thing is on the `head`, its
pixels above the neck are not drawn. The crown is not a hat for this.

### Coat

```
{ "name": { "en": "a mint coat" }, "ramp": ["#00796b", "#4db6ac", "#b2dfdb"] }
```

A coat is colours, not a drawing: `ramp` is 2 to 4 colours from dark to light. Each colour of the animal's body that can change
takes the colour of the ramp that matches how light it was, so light and dark parts stay apart. The eyes, the cheeks and the
fixed colours stay. On a light terminal theme the pale pixels of a coat take the ramp's first colour where they touch the
background. One coat is on at a time; `/pet wear plain` gives back the animal's own colours.

### A larger body

`size` lets an animal be drawn larger than 12 by 10, up to 24 by 24, for a drawing with more in it than our own. It takes that
much more of the band: an animal of w by h pixels is w columns wide and h/2 rows of text tall, and with a thing on it w+2 by
h/2+1. The shipped animals take 12 by 5 (14 by 6 with a thing on); the largest body takes 24 by 12 (26 by 13). Where the
terminal gives the band less than the drawing needs, the band falls back to one row of text. Anchors, `gold` and `wear` of
such an animal are counted on its own size; a thing with no drawing for it is set by its anchors as on any other.

## Limits

| | |
| --- | --- |
| file size | 512 KiB |
| packs read from the folder | 16, in the order of their names |
| animals, items, coats in a pack | 8, 24, 8 |
| frames in a state, rare frames, gestures, frames in a gesture | 8, 4, 8, 6 |
| own colours of an animal, tints | 24, 8 |
| body of an animal | 12 by 10 pixels, or its own `size` up to 24 by 24 |
| pieces in a fallback, animals in a `draw` or items in a `wear` | 4, 32 |

Only regular `.json` files are read. A link is not followed, and other files in the folder are ignored.

## When a pack is left out

`/pet skins` lists every file it found: what each sound pack brings, and for each one left out the faults, with where they are:

```
Skin packs in /home/you/.claude/cachito-skins: 1 loaded, 1 left out.
  broken.json   left out, nothing of it is used:
      animals.robot.palette.B: a colour is written #rrggbb
      items.tophat.part: must be one of head, face, body, feet, accessory
  example.json  Example (example)  animals: robot; items: tophat; coats: mint
```

Up to 12 faults are told for one pack. `npm run skin:check <file>` tells the same ones, except a name taken by another pack of
your folder, which only shows there.

## Importing a Codex pet

Pets made for OpenAI's Codex are shared in public galleries, and many people have one already. `npm run skin:import` turns
one into a Cachito pack:

```
npm run skin:import <folder of the pet | its pet.json> [--size 20x22] [--colours 16]
                    [--author <name>] [--license <licence>] [--source <url>] [--out <folder>]
```

It reads the pet's two files **from your own disk** and writes `codex-<id>.json` into `~/.claude/cachito-skins/` (or `--out`).
It downloads nothing and runs nothing from the pet's folder. Then `/pet skins` and `/pet animal <id>` in Claude Code.

### The Codex format, as we found it

There is no complete specification published by OpenAI. What follows is from the official `hatch-pet` skill, from the source
of the Codex terminal client, and from the galleries, read on 13 November 2026:

- A pet is a folder, `${CODEX_HOME:-~/.codex}/pets/<name>/`, with `pet.json` and one sprite sheet, `spritesheet.webp` by default
  ([codex-pet-contract.md](https://github.com/openai/skills/tree/main/skills/.curated/hatch-pet/references) in openai/skills;
  `codex-rs/tui/src/pets/model.rs` in [openai/codex](https://github.com/openai/codex)).
- `pet.json` holds `id`, `displayName`, `description`, `spritesheetPath`. It has **no field for an author or a licence**.
- The sheet is a transparent PNG or WebP of 1536 by 1872 pixels: 8 columns and 9 rows of cells of 192 by 208
  ([OpenAI's page on pets](https://learn.chatgpt.com/docs/pets.md)). Each row is one state, with a fixed number of cells:
  idle 6, running-right 8, running-left 8, waving 4, jumping 5, failed 8, waiting 6, running 6, review 6
  (`references/animation-rows.md` of the same skill). The timing is the application's, not the pet's.
- The galleries also use a second version, 1536 by 2288 with two more rows (16 directions of the gaze) and
  `"spriteVersionNumber": 2` in `pet.json`. It is documented by the galleries only
  ([legeling/awesome-codex-pet](https://github.com/legeling/awesome-codex-pet), [OpenPetsHQ/openpets](https://github.com/OpenPetsHQ/openpets),
  [crafter-station/petdex](https://github.com/crafter-station/petdex)); the official skill and page describe the first one.
- Licences are the pet's maker's, not the format's. legeling's gallery keeps them in a `submission.json` beside each pet
  (`author`, `license`, `source_url`); most of its pets are non-commercial (CC BY-NC 4.0, fan art), some are MIT, CC BY or CC0,
  some declare none. The gallery repositories themselves are MIT, which covers their code and not the pets.

### What the importer does

- **Reads** `pet.json` and the sheet it names, which must be inside the pet's folder. Only regular files are opened: a link,
  a device or a pipe is refused, and so is a `pet.json` or `submission.json` over 64 KiB. PNG and lossless WebP are read by code of
  our own (`engine/image.js`), with no dependency. A lossy WebP is not: convert the sheet to PNG first.
  Both versions of the sheet are taken; the two rows of the gaze are not used.
- **Takes three states**: still from the first cell of `idle` (the other cells of `idle` become a small gesture, and the one
  least like the first is shown now and then, as a blink is); happy from `waving` (`jumping` when there is no wave); asleep
  from `waiting`, because a Codex pet has no sleep. Every other mood is drawn as still.
- **Reduces** each cell of 192 by 208 to our grid: the same window for every frame, the one the pet takes standing, so it
  fills the grid and stands on the ground. Each pixel of ours takes the colour most of what it covers has, with dark pixels
  counted for more so that eyes and outlines survive. The colours are then cut to a palette of 16 (`--colours`, up to 24).
- **Size**: 20 by 22 pixels unless `--size` says otherwise, that is 20 columns by 11 rows of text in the band (22 by 12 with a
  thing on). 12 by 10, the size of our own animals, is too small for these drawings: they come out as blobs.
- **Keeps the credits**: the pack's `name` is the pet's `displayName`, and `credits` holds the author, the licence and the
  source from `submission.json` when it is beside the pet, or from `--author`, `--license`, `--source`. With neither, they read
  `not declared`, and the importer tells you to check the licence where you got the pet. The importer does not judge a
  licence: whether you may convert and share a pet is its licence's to say.
- **Checks** the pack with the rules every pack is checked with, and writes nothing when it is not sound. It never writes over
  a file that is not an earlier import of the same pet.

### How they come out

Tried on three public pets (`pixel-duck` by Flamur Maliqi, CC BY 4.0; `crt-monitor` by wxy, CC BY 4.0; `minty` by Somnusochi, MIT):
a pet drawn as pixel art comes out well, close to the original; a simple object keeps its shape and loses the small marks of
its face; a detailed character becomes a small figure with its colours and little else. A terminal cell is a coarse pixel.

### Why the mod does not read a Codex pet directly

It could, with the same reader, but it does not: a sheet is 2 to 20 MiB against the 4 MiB a mod may read at once, and decoding
and reducing it at every start, inside the mod, would be slow and fragile. The importer does that work once, outside Claude
Code, and what the mod loads is a small pack it can check whole.
