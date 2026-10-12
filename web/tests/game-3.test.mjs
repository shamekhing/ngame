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

