// Stains, cracks, drains, plants, and puddles.
import { R, dot, hline, vline, rnd, pick, shade } from './primitives.js';
import { circle, ellipse, outline } from './shapes.js';

// ---------------------------------------------------------------------------
// props and grime (flat, non-blocking dressing)
// ---------------------------------------------------------------------------

/** irregular flat blotch built from seeded pixel rectangles */
export function stain(ctx, x, y, radius, colors, salt = 0) {
  for (let i = 0; i < 7; i += 1) {
    const rx = radius * rnd(salt + i * 3, 0.4, 1.0);
    const ry = radius * rnd(salt + i * 5 + 1, 0.35, 0.95);
    const cx = x + rnd(salt + i * 11, -radius, radius) * 0.5;
    const cy = y + rnd(salt + i * 13 + 2, -radius, radius) * 0.5;
    R(ctx, cx - rx / 2, cy - ry / 2, rx, ry, pick(salt + i, colors));
  }
}

export function crack(ctx, x, y, length, color, salt = 0, dy = 0.4) {
  for (let i = 0; i < Math.trunc(length); i += 1) {
    x += rnd(salt + i * 3, -1.6, 1.6);
    y += dy;
    R(ctx, x, y, 1 + (i % 3 === 0 ? 1 : 0), 1, color);
  }
}

/** recessed drain grate: dark slot, set-in bars, shadowed lip */
export function grate(ctx, x, y, w, h, art) {
  R(ctx, x, y, w, h, art.metalDark);
  R(ctx, x + 1, y + 1, w - 2, h - 2, shade(art.metalDark, -0.35));
  for (let gx = Math.trunc(x) + 3; gx < Math.trunc(x + w) - 2; gx += 5) {
    vline(ctx, gx, y + 3, h - 6, art.metal);
  }
  outline(ctx, [x, y, w, h], shade(art.metalDark, 0.2), 1);
}

export function manhole(ctx, x, y, radius, art) {
  circle(ctx, x, y, radius, art.metalDark);
  circle(ctx, x, y, radius - 2, art.metal);
  circle(ctx, x, y, radius - 3, shade(art.metal, 0.18), 1);
  for (let i = 0; i < 4; i += 1) {
    const a = (Math.PI * 2 * i) / 4;
    dot(ctx, x + Math.cos(a) * radius * 0.45 - 1, y + Math.sin(a) * radius * 0.45 - 1,
      art.metalDark, 3);
  }
}

/** wet patch with a lit rim and horizontal sheen (reflects the neon) */
export function puddle(ctx, x, y, rx, ry, art, neon = false, salt = 0) {
  ellipse(ctx, x, y, rx, ry, art.puddle);
  ellipse(ctx, x, y, rx, ry, art.puddleSheen, 1);
  for (let i = 0; i < 3; i += 1) {
    const w = rx * rnd(salt + i * 7, 0.5, 1.2);
    hline(ctx, x - w / 2, y + ry * rnd(salt + i * 5, -0.5, 0.5), w, art.puddleSheen);
  }
  if (neon) {
    const w = rx * 1.3;
    R(ctx, x - w / 2, y - 1, w, 2, art.neon);
  }
}

export function weeds(ctx, x, y, n, colors, salt = 0) {
  for (let i = 0; i < n; i += 1) {
    const wx = x + rnd(salt + i * 3, -9, 9);
    const wy = y + rnd(salt + i * 7, -7, 7);
    for (let k = 0; k < 3; k += 1) {
      const h = Math.trunc(rnd(salt + i * 5 + k, 3, 8));
      const c = pick(salt + i * 2 + k, colors);
      vline(ctx, wx + k - 1, wy - h, h, c);
      dot(ctx, wx + k - 1, wy - h, shade(c, 0.3), 1);
    }
  }
}

/** top-down potted bush (the reference pack's `tree` in plan view) */
export function plant(ctx, x, y, scale, art) {
  const r = 13 * scale;
  circle(ctx, x, y, r * 0.7, art.pot);
  for (let i = 0; i < 9; i += 1) {
    const a = (Math.PI * 2 * i) / 9 + rnd(x + y + i, -0.4, 0.4);
    const rr = r * rnd(x * 3 + i, 0.55, 1.0);
    circle(ctx, x + Math.cos(a) * rr * 1.1, y + Math.sin(a) * rr * 0.85, rr, pick(i, art.foliage));
  }
  circle(ctx, x - r * 0.35, y - r * 0.45, r * 0.3, shade(art.foliage[0], 0.35));
}

