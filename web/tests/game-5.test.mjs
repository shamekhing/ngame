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
