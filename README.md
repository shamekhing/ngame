# Catch the Girl

A local **2-player, top-down arena chase** game that runs in the browser
(JavaScript + Canvas). One player controls the **Guy** who hunts; the other
controls the **Girl** who tries to escape. Each round ends in a scene from the
project's existing pixel-art sprite sheets: the guy catching her plays **Sex 1**,
the girl surviving the clock plays **Sex 2**. Two people can also play online
over a direct peer-to-peer connection - no server, no accounts.

> All character art is loaded from the existing `assets/` sprite strips
> (48x48 horizontal frame sheets). No new art files were added - the arenas are
> painted procedurally at runtime (`web/js/arena.js`).

---

## Quick start

```bash
python3 -m http.server 8000     # any static server works
# then open http://localhost:8000/web/
```

No install and no build step. Controls: **P1 = WASD + F (+ Left Shift)**,
**P2 = Arrow keys + Space (+ Right Shift)**, **`R`** swaps roles on the menu,
**Esc** returns to the menu. See *Play in a browser (and online)* below for the
online setup.

---

## How to play

Best-of match: **first to 3 round wins** takes the match. Each round lasts
**60 seconds**.

- The **Guy** wins the round by getting close and **grabbing** the Girl, which
  plays the **Sex 1** scene (`CAUGHT!`).
- The **Girl** wins the round by **surviving until the timer runs out**, which
  plays the **Sex 2** scene (`ESCAPED!`).
- The Girl can **slap** the Guy when he is close to **stun** him (~1.2s) and
  knock him back. The slap has a ~3s cooldown and cycles through three attack
  animations (`SLAP` bar in the HUD).
- The Girl can **dodge** (jump-roll) for a short speed burst with brief
  **grab immunity**, and it carries her **over the low cover** blocks
  (`DODGE` bar in the HUD).
- Each round picks one of **three maze-like arenas** (`Neon Maze`, `Crossroads`,
  `Spiral`) - corridors, dead ends and one or two gaps to thread a chase through.
  The Guy is **faster**; the Girl buys herself room with the slap, the dodge, and
  a **sense ring** that warns her when he gets within `GIRL_SENSE_RADIUS`.

### Controls

| Action | Player 1 | Player 2 |
|--------|----------|----------|
| Move   | `W A S D` | `Arrow keys` |
| Action (guy: grab / girl: slap) | `F` | `Space` |
| Dodge (girl) | `Left Shift` | `Right Shift` |

By default **P1 = Guy** and **P2 = Girl**. Press **`R`** on the menu to swap
roles, then **`Enter`** to start.

---

## Play in a browser (and online)

The game runs from `web/` in plain JavaScript/Canvas - no install, no build
step, no server code. Serve the repo over http (a static host, or locally):

```bash
python3 -m http.server 8000      # then open http://localhost:8000/web/
```

| What | Where |
|------|-------|
| entry point | `web/index.html` + `web/js/main.js` (fixed 60 Hz step) |
| settings | `web/js/config.js` |
| characters | `web/js/entities.js` |
| stage painter | `web/js/arena.js` |
| scenes/HUD | `web/js/scenes.js` |
| online play | `web/js/net/` - transport, manual signalling, netcode |

### Playing online (peer to peer)

Choose a character on the main menu, then select **Host a match** or **Join with a code**. One player hosts, the other joins;
the two browsers then talk **directly to each other** - the codes you swap are
only used to introduce them:

1. **Host** presses *Host a match* and copies the code that appears.
2. **Guest** presses *Join with a code*, pastes it, presses *Use their code* and
   sends the reply back.
3. **Host** pastes that reply and presses *Use their code*.
4. When both say **connected**, the host presses **Start match** (or Enter) to begin.

The host runs the match and sends a 26-byte snapshot 30 times a second; the
guest sends its 5-byte input 60 times a second and predicts its own character in
between, so it stays responsive on a slow link. Everything a guest sees - grabs,
slaps, rounds, scores, the catch scene - is the host's decision.

### Notes and limits

- Works on the same LAN out of the box. Across the internet the connection needs
  STUN (configured) and, for strict/symmetric NATs, a TURN server, which this
  build deliberately does not ship - if the codes are exchanged but it never
  connects, that is the usual cause.
- The codes are single use; press *Leave match* to tear the channel down.
- The NSFW sheets are optional. Delete or hide `assets/Character/Sex1.png` and
  `Sex2.png` for a **--sfw** build: those scenes drop out of the pool on their
  own and the game still plays.
- Best ping wins: the build targets two players a couple of hundred ms apart at
  most, which is what the wide HUD and generous hit boxes are tuned for.

---

## Project structure

```
assets/           the sprite sheets the game loads
  Character/      girl animations (Idle, Run, Slap, Sex1, Sex2, ...)
  NPC/            guy animations (GuyIdle, GuyWalk, ...)
web/                the game (static, no build step)
  index.html      page + the online-play box
  debug.html      renders all three arenas full size for eyeballing
  css/style.css   page chrome around the canvas
  js/             config, assets, entities, arena, scenes, main
  js/net/         transport, manual signalling, netcode, session
  tests/          node --test suites (logic, render, assets, netcode)
tools/
  shots.py        headless screenshots of the browser build
  net_test.py     two real browser pages play a match over WebRTC
```

---

## The arenas

Each layout is painted once per match into a cached world-sized canvas
(`web/js/arena.js`) and then blitted through the camera, so the stage has real
materials instead of flat rectangles.

| Layout | Shape | Look |
|--------|-------|------|
| `Neon Maze` | serpentine lanes - three walls sealing alternate ends, wide U-turns | Neon Yard - wet concrete slabs, court paint, oil stains, puddles reflecting the neon, dumped tyres, street lamps |
| `Crossroads` | ring corridor around a central keep, corner blocks | Steel Warehouse - polished checkered concrete, brick walls ringed with hazard striping, pallets, drums, floor cables, skylight shafts |
| `Spiral` | two rings, mouth on the left, gap on the right | Apartment Suite - parquet block floor, pattern rugs, potted plants, warm floor lamps, skirting trim |

Every corridor is at least 100px wide against a 26x30 collider, and
`tests/game.test.mjs` flood-fills each maze with a 16px comfort margin to prove
both spawns and every low-cover block stay reachable.

The painting technique is ported from the `pixel-scene-expansion` reference pack
shipped alongside this project: everything is built from axis-aligned pixel
rectangles, a deterministic xorshift PRNG (`seed`), generated material textures
(concrete, brick, wood, steel), stepped cast shadows and hard-edged dithered
light. Add a new look by writing a painter in `web/js/arena.js` and registering
it in `KINDS` / `PAINTERS` / `VIGNETTE_TINT`.

---

## Gameplay tuning

Balance knobs live in `web/js/config.js`:

- `ROUND_SECONDS` - round length (default 60)
- `SLAP_STUN_MS` / `SLAP_COOLDOWN_MS` / `SLAP_RADIUS` - the girl's slap
- `GRAB_RADIUS` / `ALERT_RADIUS` - the guy's grab reach and alert trigger
- `GUY_SPEED` / `GIRL_SPEED` - movement speeds
- `WIN_TARGET` - rounds needed to win the match (default 3)
- `ARENA_LAYOUTS` - the three arena layouts (solid walls + low cover)
- `DODGE_MS` / `DODGE_COOLDOWN_MS` / `DODGE_SPEED` - the girl's dodge

---

## Testing

No display or browser needed - canvases and images are stubbed:

```bash
cd web && node --test    # logic, render, assets, input, arena, netcode (28 tests)
```

```bash
cd web && node --test           # logic, render, assets, input, arena, netcode
```

Two optional browser checks live in `tools/`; they need a Playwright venv:

```bash
python3 -m venv /tmp/pw && /tmp/pw/bin/pip install playwright
/tmp/pw/bin/playwright install firefox

/tmp/pw/bin/python tools/shots.py      # screenshots + a page-error report
/tmp/pw/bin/python tools/net_test.py   # two browser pages play over WebRTC
```

`net_test.py` is the real proof of the netplay path: it drives both pages
through the handshake, has the guest walk, and asserts both screens agree.

---

## Notes & limitations

- There is no dedicated "facing up" sprite in the source art, so upward movement
  reuses the side-facing sheet (standard for this asset set).
- The game is keyboard-only and intended for two people sharing one keyboard.
- No audio is included (the asset set is art-only).
