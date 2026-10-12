// Arena cache and public entry points.
import { WORLD_W, WORLD_H, WINDOW_W, WINDOW_H } from './config.js';
import { defaultCanvas, rgb } from './arena/graphics.js';
import { paintYard, paintWarehouse, paintApartment } from './arena/layouts.js';
import { makeArt } from './arena/palettes.js';
export * from './arena/graphics.js';
export * from './arena/layouts.js';
export { makeArt } from './arena/palettes.js';

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

const KINDS = { 'Neon Maze': 'yard', 'Crossroads': 'warehouse', 'Spiral': 'apartment' };
const PAINTERS = { yard: paintYard, warehouse: paintWarehouse, apartment: paintApartment };
const VIGNETTE_TINT = {
  'Neon Maze': [[6, 5, 16], 170],
  'Crossroads': [[16, 7, 8], 180],
  'Spiral': [[14, 9, 12], 160],
};
const CACHE = {};

/** chunky screen-space edge darkening tuned to the layout's palette */
export function vignetteFor(layoutName, size = [WINDOW_W, WINDOW_H], make = defaultCanvas) {
  const [tint, strength] = VIGNETTE_TINT[layoutName] || [[8, 7, 18], 200];
  const [w, h] = size;
  const c = make(w, h);
  const ctx = c.getContext('2d');
  const bands = 26;
  const band = 4;
  for (let i = 0; i < bands; i += 1) {
    const a = Math.trunc(strength * ((bands - i) / bands) ** 2);
    if (a <= 0) continue;
    const t = i * band;
    ctx.strokeStyle = rgb(tint, a);
    ctx.lineWidth = band;
    ctx.strokeRect(t + band / 2, t + band / 2, w - t * 2 - band, h - t * 2 - band);
  }
  return c;
}

/** paint (once, cached) and return the world-sized backdrop for a layout */
export function buildArena(layoutName, walls, lowWalls, make = defaultCanvas) {
  let entry = CACHE[layoutName];
  if (!entry) {
    const kind = KINDS[layoutName] || 'yard';
    const surface = make(WORLD_W, WORLD_H);
    PAINTERS[kind](surface.getContext('2d'), makeArt(kind, make), walls, lowWalls, make);
    entry = { surface, vignette: vignetteFor(layoutName, [WINDOW_W, WINDOW_H], make), kind, art: null };
    CACHE[layoutName] = entry;
  }
  return entry;
}

/** test/debug helper */
export function clearArenaCache() {
  Object.keys(CACHE).forEach((k) => delete CACHE[k]);
}
