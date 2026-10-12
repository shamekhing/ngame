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

