// Headless logic + render test for the browser build.
// Mirrors python/smoke_test.py so both builds stay honest.
// Run: node --test web/tests/
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WINDOW_H, WORLD_W, WORLD_H, WIN_TARGET, FRAME, ARENA_LAYOUTS, rects, ZOOM_MAX,
  GUY_SPEED, GIRL_SPEED, GIRL_SENSE_RADIUS,
} from '../js/config.js';
import { makeAnims, NSFW_SHEETS } from '../js/assets.js';
import { MenuState, GameState, NsfwState, MatchOverState, IntroState } from '../js/scenes.js';
import { DT, stubSheets, makeCtx, makeApp, step, hold } from './helpers.mjs';

test('animation table covers every sheet and has frames', () => {
  const anims = makeAnims(stubSheets());
  // 17 base clips + the combined dodge + whichever catch scenes are enabled
  assert.equal(Object.keys(anims).length, 18 + NSFW_SHEETS.length);
  for (const [name, anim] of Object.entries(anims)) {
    assert.ok(anim.frames.length > 0, `${name} has no frames`);
    for (const f of anim.frames) assert.equal(f.sw, FRAME);
  }
  assert.equal(anims['girl-dodge'].frames.length, 9, 'dodge = Jump + Roll + Fall');
  assert.equal(anims['girl-sex1'].frames.length, 4);
  assert.equal(anims['guy-walk'].frames.length, 6);
});

test('menu: pick a character, then start through the control card', () => {
  const app = makeApp();
  app.state = new MenuState(app);
  app.state.handleKey('KeyR');
  assert.equal(app.roles.p1, 'girl');
  assert.equal(app.roles.p2, 'guy');
  app.state.handleKey('KeyR');
  assert.equal(app.roles.p1, 'guy');

  app.state.handleKey('Enter');
  assert.ok(app.state instanceof IntroState, 'the control card comes before the round');

  app.state.handleKey('Enter');              // skip the card
  assert.ok(app.state instanceof GameState);
  assert.equal(app.state.guy.x, 180);
  assert.equal(app.state.girl.x, 1280 - 180);
  assert.equal(app.state.walls.length, 9, 'Neon Maze has 4 perimeter + 5 walls');
  assert.equal(app.state.layoutName, 'Neon Maze');
});

test('menu: tapping a character card picks that character', () => {
  const app = makeApp();
  const menu = new MenuState(app);
  app.state = menu;
  menu.handleClick(630, 303);                // the girl's card
  assert.equal(app.roles.p1, 'girl');
  assert.equal(app.roles.p2, 'guy');
  menu.handleClick(330, 303);                // the guy's card
  assert.equal(app.roles.p1, 'guy');
  menu.handleClick(480, 470);                // between and below the cards: no pick
  assert.equal(app.roles.p1, 'guy');
});

// walkability: can the collider (26x30) plus a 16px comfort margin get from A to B?
// A maze that squeezes its players through 40px slots fails here.
function mazeReachable(walls, from, to) {
  const CELL = 8;
  const cols = Math.ceil(WORLD_W / CELL);
  const rows = Math.ceil(WORLD_H / CELL);
  const hits = (b, w) => b.x < w.x + w.w && w.x < b.x + b.w
                      && b.y < w.y + w.h && w.y < b.y + b.h;
  const free = (cx, cy) => {
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
    const b = { x: cx * CELL - 29, y: cy * CELL - 31, w: 58, h: 62 };
    return !walls.some((w) => hits(b, w));
  };
  const cell = ([x, y]) => [Math.floor(x / CELL), Math.floor(y / CELL)];
  const [sx, sy] = cell(from);
  const [gx, gy] = cell(to);
  const seen = new Set([`${sx},${sy}`]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === gx && y === gy) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (!seen.has(key) && free(nx, ny)) { seen.add(key); queue.push([nx, ny]); }
    }
  }
  return false;
}

test('every maze is walkable with room to spare', () => {
  const spawns = [[180, WORLD_H / 2], [WORLD_W - 180, WORLD_H / 2]];
  for (const layout of ARENA_LAYOUTS) {
    const walls = rects(layout.solid);
    assert.ok(mazeReachable(walls, spawns[0], spawns[1]),
      `${layout.name}: the spawns are not connected with 16px of clearance`);
    for (const [cx, cy] of layout.low) {
      assert.ok(mazeReachable(walls, spawns[0], [cx, cy]),
        `${layout.name}: the cover at (${cx}, ${cy}) cannot be reached`);
    }
  }
});

test('balance: the guy is faster, the girl senses him further out', () => {
  assert.ok(GUY_SPEED > GIRL_SPEED, 'he runs her down');
  const app = makeApp();
  app.startMatch({ intro: false });
  const g = app.state;
  step(app, 0.1);
  assert.equal(g.girl.sense, false, '920 px apart: she cannot sense him yet');

  g.guy.setPos(g.girl.x - GIRL_SENSE_RADIUS + 30, g.girl.y);
  step(app, 0.1);
  assert.equal(g.girl.sense, true, 'inside her sense radius she knows he is close');
});

test('control card counts down; the round opens zoomed out then pushes in', () => {
  const app = makeApp();
  app.startMatch();
  assert.ok(app.state instanceof IntroState, 'a match starts on the control card');

  step(app, 3);
  assert.ok(app.state instanceof IntroState, 'still counting down');
  step(app, 0.001);                           // one tick past the end of the card
  assert.ok(app.state instanceof GameState, 'countdown ends in a round');

  const g = app.state;
  assert.ok(Math.abs(g.camera.zoom - 0.55) < 1e-9, 'starts on the whole map');
  step(app, 60);                             // 1s into the push-in
  assert.ok(g.camera.zoom > 0.55, 'camera pushes in on the players');
  assert.ok(g.camera.zoom <= ZOOM_MAX, 'never crops the players at 1.6x');

  step(app, 120);                            // push-in done
  assert.ok(Math.abs(g.camera.center[0] - 640) < 40, 'camera settles on the pair');
});

test('movement is blocked by walls', () => {
  const app = makeApp();
  app.startMatch({ intro: false });
  const g = app.state;
  step(app, 2);                        // clear the start lock
  const before = g.guy.x;
  hold(app, ['KeyD']);
  step(app, 0.5);
  assert.ok(g.guy.x > before, 'guy should move right');
  assert.equal(g.guy.facing, 'right');

  g.guy.setPos(1280 - 40, 480);        // shove him into the right perimeter wall
  hold(app, ['KeyD']);
  step(app, 1.0);
  assert.ok(g.guy.x <= 1280 - 13, 'must not pass the right wall');
});

test('girl dodge: dash + grab i-frames', () => {
  const app = makeApp();
  app.startMatch({ intro: false });
  const g = app.state;
  step(app, 2);
  g.girl.facing = 'right';
  assert.equal(g.girl.tryDodge(g.elapsed, 1600, 520), true);
  assert.ok(g.girl.dodging && g.girl.locked);
  g.girl.move({ up: false, down: false, left: false, right: false }, DT, g.walls, g.lowWalls);
  assert.notEqual(g.girl.vx, 0, 'dodge should dash with no input');

  g.girl.x = g.guy.x + 8;              // in grab range, but dodging
  g.girl.y = g.guy.y;
  g.doAction(g.guy);
  assert.equal(g.roundOver, false, 'dodge i-frames must block the grab');
});

test('catch -> Sex 1 scene -> next round', () => {
  const app = makeApp();
  app.startMatch({ intro: false });
  const g = app.state;
  step(app, 2);
  g.onCatch();
  assert.equal(g.roundOver, true);
  assert.equal(app.match.guy, 1);
  assert.equal(g.girl.animName, 'girl-death');
  step(app, 1.0);
  assert.ok(app.state instanceof NsfwState, `expected NsfwState, got ${app.state.constructor.name}`);
  assert.equal(app.state.sequence.length, 1, 'the guy-win round shows one scene');
  assert.equal(app.state.sequence[0].anim, 'girl-sex1', 'guy win -> Sex 1');
  assert.equal(app.state.title, 'CAUGHT!');

  step(app, 0.6);                      // input grace
  app.state.handleKey('KeyZ');         // -> finish -> next round
  assert.ok(app.state instanceof GameState);
  assert.equal(app.match.round, 2);
  assert.equal(app.state.layoutName, 'Crossroads', 'layout cycles with the round');
});

test('escape path: timer runs out -> Sex 2 scene -> next round', () => {
  const app = makeApp();
  app.startMatch({ intro: false });
  const g = app.state;
  step(app, 2);
  g.timeLeft = 0.05;
  step(app, 0.3);
  assert.equal(g.roundOver, true);
  assert.equal(app.match.girl, 1);
  step(app, 1.6);                      // banner callback
  assert.ok(app.state instanceof NsfwState,
    `expected the girl-win scene, got ${app.state.constructor.name}`);
  assert.equal(app.state.sequence.length, 1);
  assert.equal(app.state.sequence[0].anim, 'girl-sex2', 'girl win -> Sex 2');
  assert.equal(app.state.title, 'ESCAPED!');

  step(app, 0.6);
  app.state.handleKey('KeyZ');
  assert.ok(app.state instanceof GameState);
  assert.equal(app.match.round, 2);
});

test('three escapes end the match with the girl-win scene', () => {
  const app = makeApp();
  app.startMatch({ intro: false });
  for (let round = 1; round <= WIN_TARGET; round += 1) {
    assert.ok(app.state instanceof GameState, `round ${round} should be playable`);
    app.state.timeLeft = 0.05;
    step(app, 1.8);                    // clock runs out, banner, scene
    assert.ok(app.state instanceof NsfwState, `round ${round} shows a scene`);
    assert.equal(app.state.sequence[0].anim, 'girl-sex2');
    step(app, 0.6);
    app.state.handleKey('KeyZ');       // -> finish
  }
  assert.equal(app.match.girl, WIN_TARGET);
  assert.ok(app.state instanceof MatchOverState, 'girl takes the match');
  assert.equal(app.state.winner, 'girl');
});

test('match ends and returns to the menu', () => {
  const app = makeApp();
  app.startMatch({ intro: false });
  let guard = 0;
  while (!(app.state instanceof MatchOverState) && guard < 25) {
    guard += 1;
    const st = app.state;
    if (st instanceof GameState) {
      step(app, 1.4);
      if (app.state instanceof GameState) {
        app.state.onCatch();
        step(app, 1.0);
      }
    } else if (st instanceof NsfwState) {
      st.done = true;
      st.finish();
    }
  }
  assert.ok(app.state instanceof MatchOverState, 'match should end');
  assert.ok(app.match.guy >= WIN_TARGET);
  app.state.handleKey('Enter');
  assert.ok(app.state instanceof MenuState);
});

test('every state renders a frame without throwing', () => {
  const app = makeApp();
  app.state = new MenuState(app);
  const menu = makeCtx();
  app.state.draw(menu.ctx);
  assert.ok(menu.calls.fillText > 3, 'menu draws text');
  assert.equal(menu.calls.drawImage, 2, 'menu draws both previews');

  app.startMatch({ intro: false });
  step(app, 2);
  const game = makeCtx();
  app.state.draw(game.ctx);
  assert.ok(game.calls.drawImage >= 2, 'both characters are drawn');
  assert.ok(game.calls.texts.some((t) => t.startsWith('TIME')), 'HUD shows the timer');
  assert.ok(game.calls.texts.some((t) => t.includes('Neon Maze')), 'HUD shows the layout');
  assert.ok(game.calls.fillRect >= 2, 'HUD bars are painted');
  assert.ok(game.calls.strokeRect > 0 || game.calls.drawImage >= 3, 'the arena is drawn');

  app.state.onCatch();
  step(app, 1.0);
  const nsfw = makeCtx();
  app.state.draw(nsfw.ctx);
  assert.ok(nsfw.calls.texts.includes('CAUGHT!'));
  assert.equal(nsfw.calls.drawImage, 1, 'catch scene draws the sheet');

  const over = new MatchOverState(app, 'guy');
  const overCtx = makeCtx();
  over.draw(overCtx.ctx);
  assert.ok(overCtx.calls.texts.some((t) => t.includes('GUY WINS')));
});

test('arena layouts stay inside the world and have 4 perimeter walls', () => {
  assert.equal(ARENA_LAYOUTS.length, 3);
  for (const layout of ARENA_LAYOUTS) {
    for (const [cx, cy, w, h] of [...layout.solid, ...layout.low]) {
      assert.ok(w > 0 && h > 0, `${layout.name}: bad size`);
      assert.ok(cx - w / 2 >= 0 && cx + w / 2 <= WORLD_W, `${layout.name}: escapes width`);
      assert.ok(cy - h / 2 >= 0 && cy + h / 2 <= WORLD_H, `${layout.name}: escapes height`);
    }
    const rim = rects(layout.solid).filter(
      (r) => r.x <= 1 || r.y <= 1 || r.x + r.w >= WORLD_W - 1 || r.y + r.h >= WORLD_H - 1,
    );
    assert.equal(rim.length, 4, `${layout.name} should have 4 perimeter walls`);
  }
  assert.equal(WINDOW_H, 540);
});
