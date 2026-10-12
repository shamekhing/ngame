// Pixel-art arena painter (same technique as the pixel-scene-expansion
// reference pack): every shape is an axis-aligned pixel rect (or a stepped
// circle) drawn from a seeded PRNG. The stage is painted once per layout into
// an offscreen canvas and then blitted through the camera.

// ---------------------------------------------------------------------------
// pixel primitives
// ---------------------------------------------------------------------------

/** css colour for a [r,g,b] or [r,g,b,a] array (alpha is 0-255, like pygame) */
export function rgb(c, a) {
  if (c.length === 4) return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, c[3] / 255).toFixed(4)})`;
  if (a === undefined || a >= 255) return `rgb(${c[0]},${c[1]},${c[2]})`;
  return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, a / 255).toFixed(4)})`;
}

export function R(ctx, x, y, w, h, color) {
  w = Math.round(w);
  h = Math.round(h);
  if (w < 1 || h < 1) return;
  ctx.fillStyle = typeof color === 'string' ? color : rgb(color);
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

export function dot(ctx, x, y, color, size = 2) { R(ctx, x, y, size, size, color); }

export function hline(ctx, x, y, w, color) { R(ctx, x, y, w, 1, color); }

export function vline(ctx, x, y, h, color) { R(ctx, x, y, 1, h, color); }

/** deterministic xorshift PRNG, same as the reference pack */
export function seed(n) {
  let x = (Math.trunc(n) & 0xFFFFFFFF) || 0x9E3779B9;
  x ^= (x << 13) & 0xFFFFFFFF;
  x ^= x >>> 17;
  x ^= (x << 5) & 0xFFFFFFFF;
  return (x & 0xFFFFFFFF) / 4294967296;
}

export function rnd(n, lo, hi) { return lo + seed(n) * (hi - lo); }

export function pick(n, seq) { return seq[Math.floor(seed(n) * seq.length) % seq.length]; }

export function mix(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}

/** blend a colour toward white (t > 0) or black (t < 0) */
export function shade(color, t) {
  return mix(color, t > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(t));
}

/** canvas factory: overridable so headless tests can inject a stub */
export function defaultCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

