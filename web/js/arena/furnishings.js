// Rugs, crates, barrels, cables, and lamps.
import { R, dot, hline, defaultCanvas, glow } from './primitives.js';
import { circle, outline } from './shapes.js';

/** layered pattern floor rug */
export function rug(ctx, rect, art) {
  const [x, y, w, h] = rect;
  R(ctx, x, y, w, h, art.rug);
  R(ctx, x + 4, y + 4, w - 8, h - 8, art.rugHi);
  R(ctx, x + 11, y + 11, w - 22, h - 22, art.rug);
  R(ctx, x + 17, y + 17, w - 34, h - 34, art.rugLo);
  for (let i = x + 7; i < x + w - 8; i += 7) {
    dot(ctx, i, y + 7, art.rugLo, 2);
    dot(ctx, i, y + h - 9, art.rugLo, 2);
  }
  for (let i = y + 7; i < y + h - 8; i += 7) {
    dot(ctx, x + 7, i, art.rugLo, 2);
    dot(ctx, x + w - 9, i, art.rugLo, 2);
  }
}

export function pallet(ctx, x, y, art) {
  R(ctx, x - 26, y - 20, 52, 40, art.woodDark);
  for (let i = 0; i < 4; i += 1) {
    R(ctx, x - 25, y - 19 + i * 10, 50, 8, art.woodPlank);
    hline(ctx, x - 25, y - 19 + i * 10, 50, art.woodHi);
  }
  R(ctx, x - 24, y - 14, 48, 3, art.woodDark);
}

/** steel drum seen from above: body, rolled rim, lid ring and bung */
export function barrel(ctx, x, y, art, radius = 16) {
  circle(ctx, x, y, radius, art.barrelDark);
  circle(ctx, x, y, radius - 2, art.barrel);
  circle(ctx, x, y, radius - 2, art.barrelHi, 1);
  circle(ctx, x, y, Math.max(3, radius - 5), art.barrelHi, 1);
  dot(ctx, x - radius * 0.35, y - radius * 0.45, art.barrelHi, 3);
}

/** stack of tyres seen from above (flat dressing, never a collider) */
export function tyres(ctx, x, y, dark = [24, 22, 32], light = [54, 51, 66], rings = 3) {
  for (let i = 0; i < rings; i += 1) {
    const r = Math.max(4, 20 - i * 5);
    circle(ctx, x, y, r, dark);
    circle(ctx, x, y, r, light, 2);
  }
  dot(ctx, x - 2, y - 3, light, 2);
}

/** loose cable snaking across the floor */
export function cable(ctx, points, color, sag = 0) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const steps = Math.trunc(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) + 1;
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      dot(ctx, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + sag * Math.sin(Math.PI * t), color, 2);
    }
  }
}

export function dashLine(ctx, x, y, length, color, dash = 18, gap = 14, horizontal = true) {
  for (let p = 0; p < length; p += dash + gap) {
    const seg = Math.min(dash, length - p);
    if (horizontal) R(ctx, x + p, y, seg, 2, color);
    else R(ctx, x, y + p, 2, seg, color);
  }
}

/** overhead light: a contained dithered pool plus the fixture seen above it */
export function lamp(ctx, x, y, art, radius = 84, peak = 0.5, make = defaultCanvas) {
  glow(ctx, x, y, art.lamplight, radius, 9, peak, make);
  circle(ctx, x, y, 10, art.wallLine);
  circle(ctx, x, y, 9, art.metalDark);
  circle(ctx, x, y, 7, art.metal);
  circle(ctx, x, y, 4, art.lamplight);
  dot(ctx, x - 3, y - 4, art.metalHi, 2);
}

export function paintOutline(ctx, rect, color, thick = 2) {
  outline(ctx, rect, color, thick);
}

