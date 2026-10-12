// Floors, walls, and cover.
import { WORLD_W, WORLD_H } from '../config.js';
import { rgb, R, dot, hline, vline, seed, rnd, pick, defaultCanvas, blitTiled, ditherTile } from './primitives.js';

// ---------------------------------------------------------------------------
// floors
// ---------------------------------------------------------------------------

export function floorBase(ctx, art) {
  R(ctx, 0, 0, WORLD_W, WORLD_H, art.floor);
  blitTiled(ctx, art.floorTex, [0, 0, WORLD_W, WORLD_H]);
}

export function floorGrid(ctx, art, step, color) {
  for (let x = 0; x <= WORLD_W; x += step) vline(ctx, x, 0, WORLD_H, color);
  for (let y = 0; y <= WORLD_H; y += step) hline(ctx, 0, y, WORLD_W, color);
}

/** concrete: fine texture, half-grid, slab grid, per-slab tone bands */
export function floorSlabs(ctx, art) {
  floorBase(ctx, art);
  const slab = art.slab;
  floorGrid(ctx, art, slab / 2, art.seamHalf);
  floorGrid(ctx, art, slab, art.seam);
  const tints = art.slabTints;
  const cols = WORLD_W / slab + 1;
  const rows = WORLD_H / slab + 1;
  for (let ry = 0; ry < rows; ry += 1) {
    for (let rx = 0; rx < cols; rx += 1) {
      const idx = Math.trunc(seed(rx * 31 + ry * 17 + art.salt) * (tints.length + 1));
      if (idx < tints.length) ctx.drawImage(tints[idx], rx * slab, ry * slab);
    }
  }
}

/** 96px alternating polish bands (reads as a cleaned warehouse floor) */
export function floorChecker(ctx, art) {
  if (!art.checker) return;
  const size = art.slab;
  for (let y = 0; y < WORLD_H; y += size) {
    for (let x = 0; x < WORLD_W; x += size) {
      if ((x / size + y / size) % 2 === 0) ctx.drawImage(art.checker, x, y);
    }
  }
}

/** wood-block floor: plank rows, staggered joints, per-plank tone */
export function floorParquet(ctx, art) {
  floorBase(ctx, art);
  const ph = art.plankH;
  const plen = art.plankLen;
  for (let row = 0, y = 0; y < WORLD_H; y += ph, row += 1) {
    hline(ctx, 0, y, WORLD_W, art.plankDark);
    hline(ctx, 0, y + 1, WORLD_W, art.plankLight);
    const off = row % 2 === 0 ? 0 : -(plen / 2);
    for (let x = off; x < WORLD_W; x += plen) {
      if (x >= 0) vline(ctx, x, y, ph, art.plankDark);
      if (seed(row * 131 + x) > 0.6) {
        R(ctx, x + 1, y + 1, plen - 1, ph - 1, pick(row * 7 + x, art.plankTones));
      }
    }
    for (let k = 0; k < 3; k += 1) {
      const gx = rnd(row * 17 + k, 4, WORLD_W - 48);
      R(ctx, gx, y + 3 + Math.trunc(rnd(row * 5 + k, 0, Math.max(1, ph - 5))),
        Math.trunc(rnd(k * 11 + row, 12, 40)), 1, art.plankDark);
    }
  }
}

/** floor trim hugging the outside of a wall block (skirting / molding) */
export function trimBand(ctx, r, color, pad = 7, thick = 5) {
  R(ctx, r.x - pad, r.y - pad, r.w + pad * 2, thick, color);
  R(ctx, r.x - pad, r.y + r.h + pad - thick, r.w + pad * 2, thick, color);
  R(ctx, r.x - pad, r.y - pad, thick, r.h + pad * 2, color);
  R(ctx, r.x + r.w + pad - thick, r.y - pad, thick, r.h + pad * 2, color);
}

