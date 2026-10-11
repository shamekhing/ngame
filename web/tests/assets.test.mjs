// Asset loading, including the --sfw path where the catch-scene sheets are absent.
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAssets, NSFW_SHEETS, GIRL_SHEETS, GUY_SHEETS } from '../js/assets.js';
import { installFakeImage, FRAMES } from './helpers.mjs';

test('loads every sheet, builds the anim table and the full catch pool', async () => {
  installFakeImage();
  const { sheets, anims, nsfwPool, warnings } = await buildAssets();

  assert.equal(warnings.length, 0, warnings.join(' | '));
  assert.equal(Object.keys(sheets).length, GIRL_SHEETS.length + GUY_SHEETS.length);
  assert.ok(nsfwPool.length >= 1, 'a catch always shows something');
  assert.equal(nsfwPool.length, NSFW_SHEETS.length, 'every enabled catch sheet is in the pool');
  for (const entry of NSFW_SHEETS) {
    assert.ok(anims[entry.anim], `${entry.anim} missing from the table`);
    assert.equal(anims[entry.anim].frames.length, FRAMES[entry.sheet]);
  }
  assert.equal(anims['girl-idle'].frames.length, 6);
  assert.equal(anims['guy-walk'].frames.length, 6);
  assert.equal(anims['girl-dodge'].frames.length, 9);
});

test('--sfw build: missing catch sheets drop out instead of failing', async () => {
  installFakeImage({ missing: NSFW_SHEETS.map((e) => e.sheet) });
  const { anims, nsfwPool, warnings } = await buildAssets();

  assert.equal(nsfwPool.length, 0, 'no catch scenes without the sheets');
  assert.equal(warnings.length, NSFW_SHEETS.length);
  assert.equal(anims['girl-sex1'], undefined);
  assert.ok(anims['girl-run'], 'the rest of the game still works');
});

test('a missing required sheet is a hard error', async () => {
  installFakeImage({ missing: ['Run'] });
  await assert.rejects(() => buildAssets(), /failed to load/);
});
