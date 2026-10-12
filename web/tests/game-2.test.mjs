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

