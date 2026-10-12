# Catch the Girl — code and editing guide

A two-player top-down chase game made with plain HTML, CSS, JavaScript, and Canvas. The source files are the build: there is no bundler and no npm install step. The game can run locally, on GitHub Pages, or inside the small itch.io wrapper in `itch.html`.

## Run it while editing

From the repository root:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/web/`. Keep the server at the repository root: `web/` loads sprite files from the sibling `assets/` directory. Refresh the page after changes. The browser's developer console will show JavaScript and missing-file errors.

Run the logic tests with:

```bash
cd web
node --test
```

No npm dependencies are needed. For a quick manual check after an edit, try the menu, start a local match, move both characters, trigger a catch, advance to the next round, and use the menu button. On a phone, also check portrait and landscape layouts and the joystick.

## Where things live

| File | What it controls |
| --- | --- |
| `web/index.html` | The menu, lobby, game canvas, result buttons, and touch-control elements. |
| `web/css/style.css` | Imports `base.css`, `menu.css`, `touch.css`, and `responsive.css` for page layout and phone controls. |
| `web/js/main.js` | Entry point; `boot.js`, `app.js`, `app-frame.js`, `input.js`, and `ui/` hold startup, loop, input, and sizing. |
| `web/js/lobby.js` | Entry point; `lobby/` holds host/join events, code exchange, and connection messages. |
| `web/js/touch.js` | Phone joystick, touch buttons, fullscreen/landscape request, and rotation prompt. |
| `web/js/config.js` | Controls and tuning; `config/` holds dimensions and map layouts. |
| `web/js/assets.js` | Entry point; `assets/` holds sprite loading and animation definitions. |
| `web/js/entities.js` | Entry point; `entities/` holds characters, movement, collision, and animation. |
| `web/js/arena.js` | Arena cache and public entry points. |
| `web/js/arena/primitives.js` | Pixel shapes, colors, seeded randomness, shadows, and light tiles. |
| `web/js/arena/structures.js` | Floors, walls, and low cover. |
| `web/js/arena/props.js` | Decorative objects such as lamps, plants, rugs, and puddles. |
| `web/js/arena/layouts.js` | The three visual layout painters. |
| `web/js/arena/palettes.js` | Colors and texture settings for each layout. |
| `web/js/scenes.js` | Entry point; `scenes/` holds menu, countdown, gameplay, outcomes, drawing, and camera. |
| `web/js/scenes/camera.js` | Camera framing and intro zoom. |
| `web/js/scenes/game-render.js` | Gameplay view, characters, effects, and HUD. |
| `web/js/scenes/menu-render.js` | Main menu and pre-round control card drawing. |
| `web/js/scenes/outcome-render.js` | Catch/escape and match-over drawing. |
| `web/js/scenes/visuals.js` | Shared text, preview sprite, and animation helpers. |
| `web/js/net/signaling.js` | Entry point; `manual-signaler.js` and `signaling-code.js` handle WebRTC and codes. |
| `web/js/net/transport.js` | Entry point; `rtc-transport.js` wraps the WebRTC data channel. |
| `web/js/net/netcode.js` | Entry point; `packet-*` and `session-*` handle packets and multiplayer state. |
| `assets/Character/`, `assets/NPC/` | Horizontal PNG sprite strips. |
| `itch.html` | A single-file itch.io wrapper that loads the hosted GitHub Pages game in an iframe. |
| `.github/workflows/pages.yml` | GitHub Pages deployment when `master` is pushed. |

Start with the menu, style, main, lobby, touch, config, assets, and entities files for most edits. `arena.js` and `net/` are needed for map art and networking changes.

## How the game runs

`web/index.html` loads `web/js/main.js` as a JavaScript module. `main.js` calls `boot()` from `boot.js` in the browser. It finds the canvas, loads the images through `buildAssets()`, creates an `App`, starts in `MenuState`, connects the HTML buttons, and starts `requestAnimationFrame`.

`App.frame(now)` receives the browser's frame callback. It accumulates elapsed time and calls `App.step(1 / FPS)` in fixed steps (`FPS` is 60 in `config.js`). Each step handles newly pressed keys, calls the current state's `update(dt)`, and polls the network session if one exists. Drawing happens once per browser frame through the current state's `draw(ctx)`. The loop caps catch-up work at five steps after a slow frame.

The current screen is `app.state`. The main states in `scenes.js` are:

```text
MenuState → IntroState → GameState → NsfwState → next GameState
                                         └─────→ MatchOverState
```

`IntroState` shows the opening control card/countdown. `GameState` owns the current map, Guy, Girl, timer, camera, hits, and score changes. `NsfwState` plays the round-outcome sprite animation and then advances. `MatchOverState` offers rematch/menu. A state changes screen by assigning a new object to `app.state`. For example, `App.startMatch()` creates `IntroState`, and `NsfwState.finish()` creates the next `GameState` or `MatchOverState`.

`WINDOW_W = 960` and `WINDOW_H = 540` are the internal canvas resolution. `WORLD_W = 1280` and `WORLD_H = 960` are the larger arena coordinates. `fitCanvas()` in `ui/fit.js` scales the canvas to the available browser space without changing those internal coordinates. The in-game CSS removes surrounding padding and fills the viewport; the menu uses regular page layout.

## Edit gameplay and controls

Most numbers are named constants at the top of `web/js/config.js`:

- `ROUND_SECONDS`: round duration.
- `WIN_TARGET`: round wins needed to take the match.
- `GUY_SPEED`, `GIRL_SPEED`: movement speed in world pixels per second.
- `GRAB_RADIUS`, `SLAP_RADIUS`: maximum distance for each action to hit.
- `SLAP_STUN_MS`, `SLAP_COOLDOWN_MS`, `KNOCKBACK_PX`: slap behavior.
- `DODGE_MS`, `DODGE_COOLDOWN_MS`, `DODGE_SPEED`: dodge duration, cooldown, and speed.
- `GIRL_SENSE_RADIUS`: warning ring range.
- `ZOOM_MIN`, `ZOOM_MAX`, `INTRO_MS`, `CARD_MS`: camera/countdown presentation.
- `P1_KEYS`, `P2_KEYS`: keyboard mappings using `KeyboardEvent.code` names such as `KeyW` and `ArrowUp`.

Example: to make a round 90 seconds and require four wins, set `ROUND_SECONDS = 90` and `WIN_TARGET = 4`. Reload the page to use the new values.

`Input` in `input.js` stores held keys, newly pressed keys, and an analog `axis` from the phone joystick. `GameState.handleKey()` in `scenes/game-input.js` handles actions; `scenes/game-update.js` reads movement. `Character.move()` in `entities/movement.js` turns directions into velocity and moves one axis at a time so characters can slide along walls. `Guy` and `Girl` contain their special action logic, while `GameState.doAction()`, `doDodge()`, `onCatch()`, and `onEscape()` live in `scenes/game-input.js` and `scenes/game-outcome.js`.

The game supports two people on one keyboard or one player per browser. On a phone, the joystick feeds `Input.setAxis(x, y)` with values from -1 to 1. The Dodge and Action touch buttons feed the same key-input path as the keyboard. The joystick dead zone (`0.12`) and movement radius (`rect.width * 0.36`) are in `touch.js` inside `moveJoystick()`.


Continue with the [maps, scenes, menu, online play, and deployment guide](docs/editing-guide.md).
