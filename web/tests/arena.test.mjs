// The arena painter: runs headlessly against stub canvases and must actually
// paint a lot of material (this is the browser counterpart of arena.py).
import test from 'node:test';
import assert from 'node:assert/strict';

import { ARENA_LAYOUTS, rects } from '../js/config.js';
import { buildArena, makeArt, clearArenaCache, rgb, seed, shade } from '../js/arena.js';
import { makeCanvasFactory, newBucket } from './helpers.mjs';

function layout(name, index) {
  const l = ARENA_LAYOUTS.find((x) => x.name === name) || ARENA_LAYOUTS[index];
  return { walls: rects(l.solid), low: rects(l.low) };
}

test('colour helpers behave like the pygame originals', () => {
  assert.equal(rgb([40, 37, 60]), 'rgb(40,37,60)');
  assert.equal(rgb([10, 8, 18], 128), 'rgba(10,8,18,0.5020)');
  assert.equal(rgb([10, 8, 18, 0]), 'rgba(10,8,18,0.0000)');
  assert.deepEqual(shade([100, 100, 100], 0.5), [178, 178, 178]);
  assert.deepEqual(shade([100, 100, 100], -0.5), [50, 50, 50]);
  // deterministic across runs
  assert.equal(seed(7), seed(7));
  assert.ok(seed(7) >= 0 && seed(7) < 1);
  assert.notEqual(seed(7), seed(8));
});

test('every layout paints a full backdrop, once', () => {
  clearArenaCache();
  for (let i = 0; i < ARENA_LAYOUTS.length; i += 1) {
    const { walls, low } = layout(null, i);
    const bucket = newBucket();
    const make = makeCanvasFactory(bucket);
    const entry = buildArena(ARENA_LAYOUTS[i].name, walls, low, make);

    assert.equal(entry.surface.width, 1280);
    assert.equal(entry.surface.height, 960);
    assert.ok(entry.vignette, 'vignette surface exists');
    assert.equal(entry.vignette.width, 960);
    assert.equal(entry.vignette.height, 540);

    // the painter is made of thousands of pixel ops, not a flat fill
    assert.ok(bucket.fillRect > 1500, `${ARENA_LAYOUTS[i].name}: only ${bucket.fillRect} fills`);
    assert.ok(bucket.drawImage > 200, `${ARENA_LAYOUTS[i].name}: only ${bucket.drawImage} blits`);
    assert.ok(bucket.arc + bucket.ellipse > 10, 'lamps/puddles/plants are drawn');

    // cached: a second call must not repaint
    const before = bucket.fillRect;
    const again = buildArena(ARENA_LAYOUTS[i].name, walls, low, make);
    assert.equal(again.surface, entry.surface);
    assert.equal(bucket.fillRect, before, 'second build is served from the cache');
  }
});

test('each layout uses a different palette', () => {
  clearArenaCache();
  const kinds = ['Neon Maze', 'Crossroads', 'Spiral'];
  const floors = kinds.map((name) => {
    const make = makeCanvasFactory();
    const kind = { 'Neon Maze': 'yard', Crossroads: 'warehouse', Spiral: 'apartment' }[name];
    return makeArt(kind, make).floor.join(',');
  });
  assert.equal(new Set(floors).size, kinds.length, 'floors differ per layout');
});
