// Shared shadow, wall, and low-cover pass.
import { WORLD_W, WORLD_H } from '../config.js';
import { defaultCanvas, panelWall, castShadow, hazardBand, neonEdge, trimBand, crate } from './graphics.js';

function isBorder(r) {
  return r.x <= 1 || r.y <= 1 || r.x + r.w >= WORLD_W - 1 || r.y + r.h >= WORLD_H - 1;
}

/** which way the play area faces from a perimeter wall (for the neon strip) */
function borderSide(r) {
  if (r.y <= 1) return 'down';
  if (r.y + r.h >= WORLD_H - 1) return 'up';
  if (r.x <= 1) return 'right';
  return 'left';
}

export function blocks(ctx, art, walls, low, opts = {}) {
  const make = opts.make || defaultCanvas;
  const wallFunc = opts.wallFunc || panelWall;
  for (const r of walls) {
    castShadow(ctx, r, opts.shadowOff || [7, 9], 10, opts.shadowAlpha || 34, [9, 7, 20], make);
  }
  for (const r of low) castShadow(ctx, r, [5, 8], 8, 32, [9, 7, 20], make);

  for (const r of walls) {
    if (opts.hazard && !isBorder(r)) {
      hazardBand(ctx, [r.x - 4, r.y - 4, r.w + 8, r.h + 8], art, 4, make);
    }
    wallFunc(ctx, r, art);
    if (opts.neon && isBorder(r)) neonEdge(ctx, r, opts.neon, borderSide(r), 3);
    if (opts.trim) trimBand(ctx, r, opts.trim);
  }
  for (const r of low) crate(ctx, r, art);
}

// ---------------------------------------------------------------------------
// layout painters
// ---------------------------------------------------------------------------

