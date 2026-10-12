// Wall faces, cover crates, and hazard strips.
import { R, rgb, blitTiled, pick, dot, hline, vline, ditherTile, defaultCanvas } from './primitives.js';

// ---------------------------------------------------------------------------
// walls and cover
// ---------------------------------------------------------------------------

/** cast concrete / steel panel with a lit top face, seams and bolts */
export function panelWall(ctx, r, art) {
  const { x, y, w, h } = r;
  const topH = Math.max(3, Math.trunc(h / 5));
  R(ctx, x, y, w, h, art.wallMid);
  blitTiled(ctx, art.wallTex, [x, y, w, h]);
  R(ctx, x, y, w, topH, art.wallTop);
  R(ctx, x, y + h - topH, w, topH, art.wallBot);
  const step = 46;
  for (let sx = x + step; sx < x + w - 6; sx += step) vline(ctx, sx, y + 2, h - 4, art.wallSeam);
  for (let sx = x + 6; sx < x + w - 6; sx += step) {
    dot(ctx, sx + step / 2, y + topH / 2, art.wallBolt, 2);
  }
  ctx.strokeStyle = rgb(art.wallLine);
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

/** brick courses with staggered joints, mortar and rim light */
export function brickWall(ctx, r, art) {
  const { x, y, w, h } = r;
  R(ctx, x, y, w, h, art.mortar);
  const bh = 12;
  const bw = 26;
  let row = 0;
  for (let yy = y + 1; yy < y + h - 2; yy += bh, row += 1) {
    for (let xx = x + 1 - (row % 2 ? bw / 2 : 0); xx < x + w - 1; xx += bw) {
      const bx = Math.max(xx, x + 1);
      const bwid = Math.min(bw - 2, x + w - 1 - bx);
      if (bwid > 1) {
        R(ctx, bx, yy, bwid, Math.min(bh - 2, y + h - 2 - yy), pick(row * 53 + bx, art.brick));
      }
    }
  }
  R(ctx, x, y, w, 3, art.wallTop);
  R(ctx, x, y + h - 3, w, 3, art.wallBot);
  ctx.strokeStyle = rgb(art.wallLine);
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

/** glowing strip running along the play-facing edge of a wall */
export function neonEdge(ctx, r, color, inner = 'down', thick = 3) {
  if (inner === 'down') R(ctx, r.x, r.y + r.h, r.w, thick, color);
  else if (inner === 'up') R(ctx, r.x, r.y - thick, r.w, thick, color);
  else if (inner === 'right') R(ctx, r.x + r.w, r.y, thick, r.h, color);
  else R(ctx, r.x - thick, r.y, thick, r.h, color);
}

/** wooden cover crate (the girl's jump-roll clears these) */
export function crate(ctx, r, art) {
  const { x, y, w, h } = r;
  const c = art.crate;
  R(ctx, x, y, w, h, c.edge);
  R(ctx, x + 2, y + 2, w - 4, h - 4, c.base);
  for (let yy = y + 5; yy < y + h - 7; yy += 12) {
    hline(ctx, x + 3, yy, w - 6, c.dark);
    hline(ctx, x + 3, yy + 1, w - 6, c.light);
  }
  ctx.strokeStyle = rgb(c.edge);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + h - 3);
  ctx.lineTo(x + w - 4, y + 3);
  ctx.stroke();
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  R(ctx, x + 2, y + 2, w - 4, 3, c.light);
  for (const cx of [x + 5, x + w - 7]) {
    for (const cy of [y + 5, y + h - 7]) dot(ctx, cx, cy, c.nail, 2);
  }
}

/** diagonal hazard striping (wall feet, pillar bases) */
export function hazardBand(ctx, rect, art, band = 4, make = defaultCanvas) {
  blitTiled(ctx, ditherTile(art.hazardA, art.hazardB, 16, band, make), rect);
}

