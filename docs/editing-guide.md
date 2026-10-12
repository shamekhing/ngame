# Editing maps, scenes, menus, and hosting

## Edit maps and their look

`ARENA_LAYOUTS` in `config.js` contains `name`, `solid`, and `low` lists. Each rectangle is `[centerX, centerY, width, height]` in world pixels. `solid` blocks both players. `low` blocks normal movement, but the Girl can cross it during her dodge. `rects()` converts those center-based values to top-left rectangles for collision and drawing.

`GameState` selects layouts by round number:

```js
ARENA_LAYOUTS[(app.match.round - 1) % ARENA_LAYOUTS.length]
```

That means round 1 uses the first layout, round 2 the second, round 3 the third, and then it repeats. When adding a layout, give it a unique `name`, add its painted appearance in `arena/layouts.js`, add colors in `arena/palettes.js`, and register its name/painter in `arena.js`. Keep paths wide enough for the 26 × 30 player collider. `web/tests/game.test.mjs` checks that the existing layouts are reachable; run it after changing walls.

To edit the current art without changing collision, work in `web/js/arena/`. `buildArena()` in `arena.js` paints a whole arena once and caches it. The camera later crops and scales that canvas during gameplay. The `paintYard`, `paintWarehouse`, and `paintApartment` functions in `arena/layouts.js` draw the current looks. `arena/palettes.js` contains their colors. `arena/structures.js` draws floors and walls, `arena/props.js` draws decorative objects, and `arena/primitives.js` contains low-level pixel and light helpers.

## Edit characters, sprites, and round-outcome scenes

Each PNG is a horizontal strip of square **48 × 48** frames. `assets.js` loads them from `assets/Character/` or `assets/NPC/`. `stripFrames()` divides each image width by `FRAME` and creates source rectangles; `makeAnims()` assigns names and playback speeds. For example, `girl-run` comes from `assets/Character/Run.png` at 10 frames per second. If you replace a PNG, keep its frame size and file name unless you also update `assets.js`.

The menu portraits are separate CSS animations in `style.css`: `.portrait.guy` uses `GuyWalk.png`, `.portrait.girl` uses `Run.png`, and `@keyframes menu-walk` steps through six frames. If a replacement strip has a different number of frames, update its CSS `background-size`, duration, and steps count as well as the frame extraction in JavaScript if the frame size changed.

Round-outcome scene registration is near the top of `assets.js` in `NSFW_SHEETS`:

```js
{ sheet: 'Sex1', anim: 'girl-sex1', fps: 8, label: '' }
```

`sheet` is the PNG base name in `assets/Character/`, `anim` is its internal animation key, `fps` is playback speed, and `label` is optional on-screen text. To add a scene using a new strip, put the PNG in `assets/Character/` and add an entry to `NSFW_SHEETS`. `buildAssets()` loads these entries as optional files and puts the successfully loaded ones in `app.nsfwPool`. `NsfwState` in `scenes.js` draws the selected animation at 5× its source size and advances automatically after five seconds or on input after a short grace period.

The default outcome mapping is in `web/js/net/netcode.js` as `WIN_SCENES` and used by `GameState.onCatch()` / `onEscape()` in `scenes.js`: Guy win selects scene index 0 (`Sex1`), Girl win selects index 1 (`Sex2`). If you add a third scene, registration alone makes it available in the pool but does **not** make normal gameplay select it. Change the selection logic in `scenes.js` and keep any multiplayer event value within the pool. Missing optional scene PNGs are skipped. A `null` scene argument to `NsfwState` shuffles and plays up to two available scenes; normal catch/escape outcomes currently pass an explicit index.

## Edit the menu and mobile screen

Change visible menu text, button order, and input elements in `web/index.html`. Style those elements in `web/css/style.css`. The IDs are used by `main.js`; if you rename an ID in HTML, update every `getElementById()` or `querySelector()` that uses it. The character cards (`guyPick`, `girlPick`) call `MenuState.pickCharacter()` and update their `aria-pressed` / “You play” text.

`app.onChrome` in `main.js` switches between menu and game display. On the menu it hides the canvas stage. During a match it hides the menu, shows the stage, and shows touch controls on touch screens or narrow viewports. `fitCanvas()` keeps the 960 × 540 game image inside the available viewport. `scenes/game-render.js` draws the canvas view and HUD; `scenes/camera.js` decides which part of the larger map is visible. The `.app.in-game`, `.in-game .stage`, `.touch`, `.joystick`, and media-query rules in `style.css` determine the visible mobile layout.

`requestLandscape()` in `touch.js` asks the browser for fullscreen and a landscape orientation lock when a phone match starts. Browser support varies. If the phone remains portrait, `rotatePrompt` is shown and the player can retry landscape or choose “Play in portrait.” The rotation prompt pauses game updates until it is dismissed. The game does not force the menu into landscape.

## How online play works

Online mode uses one direct WebRTC data channel. The host creates an offer code; the guest pastes it and returns an answer code; the host pastes that answer. `setupLobby()` in `lobby.js` controls the visible host/join form, Copy/Share buttons, status messages, and Start button. `ManualSignaler` in `net/signaling.js` creates the peer connection and encodes/decodes the codes. `RTCTransport` in `net/transport.js` sends bytes over the open channel.

`NetSession` in `net/netcode.js` owns the game protocol. The guest sends movement/action input up to 60 times per second. The host decides hits, score, and transitions and sends snapshots about 30 times per second. The guest predicts its own movement for responsiveness, then corrects toward the host's snapshots. Control packets carry round/catch/match changes. If you change packet fields or event numbers, update encoding and decoding on both sides; both players should reload to the same version before connecting.

The configured ICE list in `net/signaling.js` contains one STUN server and **no TURN relay**. STUN helps browsers discover direct routes but cannot guarantee a connection across restricted phone networks. The page has no invite-link signaling server. The Copy and Share buttons only help exchange the two manual codes; they do not alter WebRTC connectivity. A game that stays on “connecting” across different mobile networks may have no usable direct route.

## The itch.io file and GitHub Pages

`itch.html` is a small wrapper, modeled on an iframe page. It is **not a copy of the game**. Its `<iframe id="game">` points to `https://shamekhing.github.io/ngame/web/`, so the uploaded file needs that live site and an internet connection. Upload `itch.html` directly as the HTML game file on itch.io. If you change the game URL, update all three occurrences in `itch.html`: the iframe `src`, “Open on its own” link, and loading-note link. The HTML `<title>` and strip text control the wrapper's visible title.

The wrapper's `#stage` fills the available frame; the iframe fills `#stage`. When itch.io embeds the wrapper in its own frame, the early script sets the `framed` class so the top strip is hidden. When opened alone, the strip offers Fullscreen and a direct link. The Fullscreen button calls `requestFullscreen()` on the iframe and then focuses it for keyboard input. The note appears after six seconds only if the iframe has not fired `load`; a `load` event means the frame finished navigating, not necessarily that the game itself is healthy. The iframe's `allow` and `allowfullscreen` attributes permit the nested game to request fullscreen where the browser and hosting frame allow it.

`.github/workflows/pages.yml` runs on pushes to `master`. It copies `web/` and `assets/` into the Pages artifact and creates a root redirect to `web/`. Therefore, edits to `web/` or `assets/` go live only after a successful workflow run. `itch.html` is not copied into GitHub Pages by that workflow; it is a separate file to upload to itch.io. Changes to the hosted game will appear inside the itch wrapper after Pages deploys and browser caches refresh. Changes to the wrapper itself require uploading the changed `itch.html` to itch.io again.

## Common edits at a glance

| I want to change… | Edit here |
| --- | --- |
| Match length, speed, score target, ranges | `web/js/config.js` |
| Keyboard controls | `P1_KEYS` / `P2_KEYS` in `web/js/config.js` |
| Joystick feel and phone buttons | `moveJoystick()` in `web/js/touch.js`; `.joystick` / `.acts` in `web/css/style.css` |
| Menu wording and buttons | `web/index.html`, corresponding handlers in `web/js/main.js` or `web/js/lobby.js` |
| Menu portraits | `.portrait.*` and `@keyframes menu-walk` in `web/css/style.css` |
| Character art and animation speed | PNGs in `assets/`; `makeAnims()` in `web/js/assets.js` |
| Catch/escape scene art or selection | `NSFW_SHEETS` in `web/js/assets.js`; `WIN_SCENES` in `web/js/net/netcode.js`; `onCatch()` / `onEscape()` in `web/js/scenes.js` |
| Arena collision or order | `ARENA_LAYOUTS` in `web/js/config.js` |
| Arena painted appearance | `web/js/arena/layouts.js`, `palettes.js`, `structures.js`, or `props.js` |
| Intro, gameplay rules, results screen | State classes in `web/js/scenes.js` |
| Gameplay HUD and camera | `web/js/scenes/game-render.js`, `camera.js` |
| Itch iframe URL or wrapper style | `itch.html` |
