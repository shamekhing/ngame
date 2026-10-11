// Browser entry point: input plumbing and the fixed-timestep loop.
import test from 'node:test';
import assert from 'node:assert/strict';

import { App } from '../js/main.js';
import { makeCtx } from './helpers.mjs';

function fakeTarget() {
  const handlers = {};
  return {
    handlers,
    addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
    dispatch(type, event) { (handlers[type] || []).forEach((fn) => fn(event)); },
  };
}

function fakeCanvas() {
  return { width: 0, height: 0, style: {}, getContext: () => makeCtx().ctx };
}

test('input tracks held keys, one-shot presses and focus loss', () => {
  const app = new App(fakeCanvas());
  const target = fakeTarget();
  app.input.attach(target);

  let prevented = 0;
  target.dispatch('keydown', { code: 'ArrowLeft', preventDefault: () => { prevented += 1; } });
  assert.ok(app.input.held.has('ArrowLeft'));
  assert.equal(prevented, 1, 'arrow keys must not scroll the page');
  assert.deepEqual(app.input.drainPressed(), ['ArrowLeft']);
  assert.deepEqual(app.input.drainPressed(), [], 'a press is delivered only once');

  target.dispatch('keydown', { code: 'KeyW', preventDefault: () => {} });
  target.dispatch('keydown', { code: 'KeyW', preventDefault: () => {} });   // auto-repeat
  assert.deepEqual(app.input.drainPressed(), ['KeyW'], 'auto-repeat is not a new press');
  assert.ok(app.input.held.has('KeyW'));

  target.dispatch('keydown', { code: 'Enter', target: { tagName: 'TEXTAREA' }, preventDefault: () => { throw new Error('typing was blocked'); } });
  target.dispatch('keydown', { code: 'Space', target: { tagName: 'BUTTON' }, preventDefault: () => { throw new Error('button was blocked'); } });
  assert.deepEqual(app.input.drainPressed(), [], 'typing and focused buttons do not trigger the game');

  target.dispatch('keyup', { code: 'KeyW' });
  assert.ok(!app.input.held.has('KeyW'));

  target.dispatch('blur', {});
  assert.equal(app.input.held.size, 0, 'losing focus releases every key');
});

test('the loop steps at a fixed 60 Hz and forwards presses to the state', () => {
  const app = new App(fakeCanvas());
  const seen = { keys: [], updates: 0 };
  app.state = {
    handleKey(code) { seen.keys.push(code); },
    update() { seen.updates += 1; },
    draw() {},
  };

  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => {};     // stop the loop recursing
  try {
    app.input.pressed.add('KeyF');
    app.last = 0;
    app.frame(1000 / 60);
    assert.deepEqual(seen.keys, ['KeyF'], 'the press reaches the state');
    assert.equal(seen.updates, 1);

    app.frame(1000 / 60 + 3 * (1000 / 60));        // ~3 more ticks
    assert.equal(seen.updates, 4);

    const before = seen.updates;
    app.frame(1000 / 60 + 3 * (1000 / 60) + 5000); // a 5 s stall
    const added = seen.updates - before;
    assert.ok(added >= 3 && added <= 5, `a stall is clamped to ~50 ms of ticks, got ${added}`);
  } finally {
    globalThis.requestAnimationFrame = raf;
  }
});
