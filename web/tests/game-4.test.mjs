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

