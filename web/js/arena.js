// Pixel-art arena painter (same technique as the pixel-scene-expansion
// reference pack): every shape is an axis-aligned pixel rect (or a stepped
// circle) drawn from a seeded PRNG. The stage is painted once per layout into
// an offscreen canvas and then blitted through the camera.
import { WORLD_W, WORLD_H, WINDOW_W, WINDOW_H } from './config.js';

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

// ---------------------------------------------------------------------------
// textures, shadows and light
// ---------------------------------------------------------------------------

/** seamless tile of `block`-sized colour blocks (toroidal indexing) */
export function noiseTile(size, colors, block, salt = 0, make = defaultCanvas) {
  const canvas = make(size, size);
  const ctx = canvas.getContext('2d');
  const n = Math.max(1, size / block);
  for (let by = 0; by < n; by += 1) {
    for (let bx = 0; bx < n; bx += 1) {
      ctx.fillStyle = rgb(pick(salt + bx * 7 + by * 131, colors));
      ctx.fillRect(bx * block, by * block, block, block);
    }
  }
  return canvas;
}

/** tile `tex` across a rect, clipping tile by tile */
export function blitTiled(ctx, tex, rect) {
  const x0 = Math.trunc(rect[0]);
  const y0 = Math.trunc(rect[1]);
  const w = Math.trunc(rect[2]);
  const h = Math.trunc(rect[3]);
  const tw = tex.width;
  const th = tex.height;
  for (let y = y0; y < y0 + h; y += th) {
    for (let x = x0; x < x0 + w; x += tw) {
      const sw = Math.min(tw, x0 + w - x);
      const sh = Math.min(th, y0 + h - y);
      if (sw > 0 && sh > 0) ctx.drawImage(tex, 0, 0, sw, sh, x, y, sw, sh);
    }
  }
}

/** stepped (chunky) drop shadow a solid block casts onto the floor */
export function castShadow(ctx, r, off = [7, 9], spread = 10, alpha = 34,
                          color = [9, 7, 20], make = defaultCanvas) {
  const w = r.w;
  const h = r.h;
  const steps = 5;
  const sh = make(w + spread * 2, h + spread * 2);
  const shCtx = sh.getContext('2d');
  for (let i = 0; i < steps; i += 1) {
    const pad = spread - Math.trunc((spread * i) / (steps - 1));
    shCtx.fillStyle = rgb(color, Math.trunc((alpha * (i + 1)) / steps));
    shCtx.fillRect(pad, pad, w + (spread - pad) * 2, h + (spread - pad) * 2);
  }
  ctx.drawImage(sh, r.x + off[0] - spread, r.y + off[1] - spread);
}

const LIGHTS = {};

/** hard-edged dithered glow, blitted additively */
export function lightPool(color, radius, steps = 9, peak = 0.5, make = defaultCanvas) {
  const key = `${color.join(',')}|${radius}|${steps}|${peak.toFixed(3)}`;
  let pool = LIGHTS[key];
  if (!pool) {
    const r = Math.trunc(radius);
    pool = make(r * 2, r * 2);
    const ctx = pool.getContext('2d');
    for (let i = 0; i < steps; i += 1) {
      const f = (i + 1) / steps;
      ctx.fillStyle = rgb(color.map((ch) => Math.trunc(ch * peak * f ** 2.6)));
      ctx.beginPath();
      ctx.arc(r, r, Math.max(1, Math.trunc(r * (1 - i / (steps + 0.5)))), 0, Math.PI * 2);
      ctx.fill();
    }
    LIGHTS[key] = pool;
  }
  return pool;
}

export function glow(ctx, x, y, color, radius, steps = 9, peak = 0.5, make = defaultCanvas) {
  const pool = lightPool(color, radius, steps, peak, make);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(pool, Math.round(x - pool.width / 2), Math.round(y - pool.height / 2));
  ctx.globalCompositeOperation = 'source-over';
}

const DITHERS = {};

/** 45-degree two-tone dither tile (hazard stripes, light spill, hatch) */
export function ditherTile(a, b, size = 16, band = 4, make = defaultCanvas) {
  const key = `${a.join(',')}|${b.join(',')}|${size}|${band}`;
  let tile = DITHERS[key];
  if (!tile) {
    tile = make(size, size);
    const ctx = tile.getContext('2d');
    ctx.fillStyle = rgb(b);
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = rgb(a);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (Math.trunc((x + y) / band) % 2 === 0) ctx.fillRect(x, y, 1, 1);
      }
    }
    DITHERS[key] = tile;
  }
  return tile;
}

/** dithered slab of light spilling across the floor */
export function lightBand(ctx, rect, color, alpha = 20, size = 16, band = 4, make = defaultCanvas) {
  blitTiled(ctx, ditherTile([...color, alpha], [0, 0, 0, 0], size, band, make), rect);
}

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

// ---------------------------------------------------------------------------
// small shape helpers (pygame draws outlines *inside*, canvas centres them)
// ---------------------------------------------------------------------------

export function circle(ctx, x, y, r, color, width = 0) {
  r = Math.trunc(r);
  if (r < 1) return;
  ctx.beginPath();
  ctx.arc(Math.round(x), Math.round(y),
    width ? Math.max(1, r - Math.trunc(width / 2)) : r, 0, Math.PI * 2);
  if (width) {
    ctx.strokeStyle = typeof color === 'string' ? color : rgb(color);
    ctx.lineWidth = width;
    ctx.stroke();
  } else {
    ctx.fillStyle = typeof color === 'string' ? color : rgb(color);
    ctx.fill();
  }
}

export function ellipse(ctx, x, y, rx, ry, color, width = 0) {
  rx = Math.trunc(rx);
  ry = Math.trunc(ry);
  if (rx < 1 || ry < 1) return;
  const inset = width ? Math.trunc(width / 2) : 0;
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(y), Math.max(1, rx - inset), Math.max(1, ry - inset),
    0, 0, Math.PI * 2);
  if (width) {
    ctx.strokeStyle = typeof color === 'string' ? color : rgb(color);
    ctx.lineWidth = width;
    ctx.stroke();
  } else {
    ctx.fillStyle = typeof color === 'string' ? color : rgb(color);
    ctx.fill();
  }
}

export function line(ctx, x0, y0, x1, y1, color, width = 2) {
  ctx.strokeStyle = typeof color === 'string' ? color : rgb(color);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(Math.round(x0), Math.round(y0));
  ctx.lineTo(Math.round(x1), Math.round(y1));
  ctx.stroke();
}

export function outline(ctx, rect, color, thick = 2) {
  ctx.strokeStyle = typeof color === 'string' ? color : rgb(color);
  ctx.lineWidth = thick;
  ctx.strokeRect(rect[0] + thick / 2, rect[1] + thick / 2,
    Math.max(1, rect[2] - thick), Math.max(1, rect[3] - thick));
}

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

// ---------------------------------------------------------------------------
// shared block pass (shadows -> walls -> cover)
// ---------------------------------------------------------------------------

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

function blocks(ctx, art, walls, low, opts = {}) {
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

/** Neon Yard - wet concrete, faded court paint, puddles, street lamps */
export function paintYard(ctx, art, walls, low, make = defaultCanvas) {
  floorSlabs(ctx, art);
  paintOutline(ctx, [150, 150, 300, 200], art.paintDim);
  hline(ctx, 150, 250, 300, art.paintDim);
  circle(ctx, 300, 250, 46, art.paintDim, 2);
  dashLine(ctx, 470, 250, 250, art.paintDim);
  dashLine(ctx, 640, 380, 250, art.paintDim, 18, 14, false);

  [[180, 300], [900, 420], [420, 800], [1140, 200]].forEach(([x, y], i) => {
    crack(ctx, x, y, 44, art.crack, 7 + i * 3);
  });
  [[300, 560], [900, 200], [1080, 700], [520, 120], [180, 500], [1180, 560]]
    .forEach(([x, y], i) => stain(ctx, x, y, 48, art.stains, 31 + i * 9));

  // loading bay paint and dumped tyres along the east kerb
  paintOutline(ctx, [1000, 620, 220, 220], art.paintDim);
  paintOutline(ctx, [1016, 636, 188, 188], art.paintDim);
  tyres(ctx, 1080, 740);
  tyres(ctx, 1160, 660);
  tyres(ctx, 152, 620);

  puddle(ctx, 560, 790, 62, 30, art, true, 5);
  puddle(ctx, 250, 230, 46, 22, art, true, 11);
  puddle(ctx, 1010, 560, 52, 24, art, false, 17);
  puddle(ctx, 780, 180, 40, 18, art, false, 23);

  grate(ctx, 168, 168, 36, 22, art);
  grate(ctx, 1150, 545, 36, 22, art);
  grate(ctx, 452, 836, 36, 22, art);
  manhole(ctx, 210, 430, 20, art);
  manhole(ctx, 1108, 760, 20, art);
  manhole(ctx, 700, 140, 18, art);

  [[288, 96], [864, 480], [432, 864], [1152, 288], [200, 700], [1000, 120]]
    .forEach(([x, y], i) => weeds(ctx, x, y, 6, art.foliage, 3 + i * 5));

  // light spilling in from the street lamps along the perimeter
  lightBand(ctx, [32, 32, WORLD_W - 64, 88], art.lamplight, 16, 16, 4, make);
  lightBand(ctx, [32, WORLD_H - 120, WORLD_W - 64, 88], art.lamplight, 16, 16, 4, make);
  for (const [x, y] of [[140, 140], [1140, 140], [140, 820], [1140, 820], [640, 170], [640, 800]]) {
    lamp(ctx, x, y, art, 88, 0.5, make);
  }
  blocks(ctx, art, walls, low, { neon: art.neon, make });
}

/** Steel Warehouse - polished concrete, hazard striping, crates, cables */
export function paintWarehouse(ctx, art, walls, low, make = defaultCanvas) {
  floorSlabs(ctx, art);
  floorChecker(ctx, art);
  dashLine(ctx, 90, 480, 1100, art.paintWarm, 26, 20);
  dashLine(ctx, 640, 110, 740, art.paintWarm, 26, 20, false);
  paintOutline(ctx, [120, 150, 200, 130], art.paintDim);
  paintOutline(ctx, [960, 690, 200, 130], art.paintDim);

  [[760, 560], [250, 620], [1080, 300], [480, 200]]
    .forEach(([x, y], i) => stain(ctx, x, y, 44, art.stains, 13 + i * 11));
  crack(ctx, 700, 250, 60, art.crack, 41);
  crack(ctx, 300, 900, 60, art.crack, 43);

  cable(ctx, [[70, 120], [420, 152], [900, 118], [1210, 158]], art.cable, 20);
  cable(ctx, [[80, 858], [500, 818], [980, 876]], art.cable, 16);
  pallet(ctx, 250, 200, art);
  pallet(ctx, 1050, 762, art);
  for (const [x, y] of [[350, 400], [960, 400], [350, 760], [960, 760]]) barrel(ctx, x, y, art);

  for (const [x, y] of [[330, 250], [950, 250], [330, 710], [950, 710]]) {
    lamp(ctx, x, y, art, 120, 0.5, make);
  }
  // skylight shafts falling between the pillars
  lightBand(ctx, [300, 40, 220, 880], art.lamplight, 18, 16, 4, make);
  lightBand(ctx, [760, 40, 220, 880], art.lamplight, 18, 16, 4, make);
  blocks(ctx, art, walls, low, { wallFunc: brickWall, hazard: true, make });
}

/** Apartment Suite - parquet floors, rugs, planting and warm floor lamps */
export function paintApartment(ctx, art, walls, low, make = defaultCanvas) {
  floorParquet(ctx, art);
  floorChecker(ctx, art);
  [[60, 80, 210, 160], [1010, 80, 210, 160], [60, 720, 210, 160], [1010, 720, 210, 160],
   [360, 340, 250, 180], [672, 340, 250, 180], [392, 52, 500, 56], [392, 858, 500, 52]]
    .forEach((r) => rug(ctx, r, art));

  for (const [x, y] of [[170, 160], [1110, 160], [170, 800], [1110, 800], [485, 430], [800, 430]]) {
    lamp(ctx, x, y, art, 72, 0.42, make);
  }
  for (const [x, y] of [[70, 70], [1210, 70], [70, 890], [1210, 890],
                        [350, 900], [930, 900], [350, 60], [930, 60]]) {
    plant(ctx, x, y, 1.0, art);
  }
  stain(ctx, 460, 620, 26, art.stains, 5);
  stain(ctx, 830, 620, 22, art.stains, 9);
  blocks(ctx, art, walls, low, { trim: art.trim, make });
}

// ---------------------------------------------------------------------------
// palettes - one cohesive colour set per layout, straight from arena.py
// ---------------------------------------------------------------------------

function tintTile(size, color, alpha, make) {
  const c = make(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = rgb(color, alpha);
  ctx.fillRect(0, 0, size, size);
  return c;
}

const PALETTES = {
  yard: {
    salt: 11, slab: 96,
    floor: [40, 37, 60],
    floorColors: [[40, 37, 60], [43, 40, 64], [37, 34, 56], [45, 42, 67], [38, 35, 58]],
    floorBlock: 6,
    seam: [52, 48, 78], seamHalf: [46, 42, 70],
    wallMid: [58, 54, 84], wallTop: [88, 82, 124], wallBot: [31, 28, 47],
    wallLine: [19, 17, 30], wallSeam: [44, 40, 64], wallBolt: [152, 143, 188],
    wallTexColors: [[0, 0, 0, 0], [255, 255, 255, 12], [0, 0, 0, 26]],
    mortar: [40, 36, 58], brick: [[58, 54, 84], [54, 50, 78], [63, 58, 90]],
    crate: { base: [104, 76, 52], light: [134, 101, 69], dark: [72, 50, 34], edge: [44, 31, 21], nail: [178, 172, 160] },
    hazardA: [206, 170, 76], hazardB: [38, 33, 52],
    paintDim: [120, 122, 156], paintWarm: [200, 190, 216],
    stains: [[28, 25, 42], [34, 30, 50], [24, 21, 36]], crack: [23, 20, 35],
    metal: [96, 92, 120], metalDark: [50, 47, 68], metalHi: [162, 158, 192],
    puddle: [58, 64, 104], puddleSheen: [112, 126, 182], neon: [218, 84, 150],
    foliage: [[58, 108, 84], [74, 132, 98], [44, 88, 70]], pot: [74, 62, 74],
    rug: [96, 60, 78], rugHi: [132, 82, 100], rugLo: [68, 42, 58],
    woodDark: [52, 38, 28], woodPlank: [92, 68, 46], woodHi: [118, 90, 62],
    barrel: [84, 70, 92], barrelDark: [48, 40, 58], barrelHi: [128, 114, 148],
    lamplight: [190, 152, 104], cable: [24, 21, 36], trim: [70, 58, 88],
    slabTints: [[[150, 170, 255], 18], [[8, 6, 22], 42], [[10, 8, 26], 24]],
  },
  warehouse: {
    salt: 23, slab: 96,
    floor: [66, 54, 62],
    floorColors: [[66, 54, 62], [70, 58, 66], [61, 50, 58], [74, 62, 70]],
    floorBlock: 6,
    seam: [86, 71, 78], seamHalf: [75, 62, 69],
    checker: [[255, 232, 200], 16],
    wallMid: [104, 62, 56], wallTop: [140, 92, 78], wallBot: [58, 34, 34],
    wallLine: [34, 20, 22], wallSeam: [78, 48, 46], wallBolt: [190, 156, 132],
    wallTexColors: [[0, 0, 0, 0], [255, 220, 190, 14], [0, 0, 0, 24]],
    mortar: [60, 38, 38], brick: [[106, 64, 56], [98, 58, 52], [114, 72, 62]],
    crate: { base: [112, 82, 54], light: [142, 108, 72], dark: [78, 54, 36], edge: [48, 34, 22], nail: [186, 178, 164] },
    hazardA: [216, 178, 76], hazardB: [44, 36, 46],
    paintDim: [206, 158, 128], paintWarm: [224, 190, 96],
    stains: [[40, 30, 30], [34, 26, 28], [46, 36, 34]], crack: [30, 24, 26],
    metal: [104, 96, 96], metalDark: [54, 48, 50], metalHi: [170, 160, 158],
    puddle: [70, 58, 62], puddleSheen: [130, 112, 108], neon: [232, 150, 74],
    foliage: [[58, 108, 84], [74, 132, 98], [44, 88, 70]], pot: [74, 62, 74],
    rug: [104, 68, 64], rugHi: [140, 92, 84], rugLo: [72, 46, 44],
    woodDark: [56, 40, 28], woodPlank: [104, 78, 52], woodHi: [132, 102, 70],
    barrel: [96, 82, 72], barrelDark: [52, 42, 38], barrelHi: [146, 128, 112],
    lamplight: [214, 168, 104], cable: [32, 26, 28], trim: [84, 54, 50],
    slabTints: [[[255, 214, 160], 14], [[10, 6, 10], 28], [[14, 8, 10], 16]],
  },
  apartment: {
    salt: 37, slab: 96,
    floor: [92, 62, 52],
    floorColors: [[92, 62, 52], [86, 57, 48], [98, 67, 56]],
    floorBlock: 8,
    seam: [74, 50, 42], seamHalf: [84, 57, 48],
    checker: [[255, 214, 170], 10],
    plankH: 12, plankLen: 96,
    plankTones: [[102, 70, 58], [84, 55, 46], [96, 64, 54]],
    plankDark: [58, 37, 31], plankLight: [118, 84, 68],
    wallMid: [112, 96, 108], wallTop: [148, 130, 140], wallBot: [74, 62, 74],
    wallLine: [42, 34, 44], wallSeam: [92, 78, 90], wallBolt: [180, 164, 174],
    wallTexColors: [[0, 0, 0, 0], [255, 240, 230, 12], [0, 0, 0, 22]],
    mortar: [96, 82, 92], brick: [[112, 96, 108], [105, 90, 102], [120, 104, 116]],
    crate: { base: [118, 86, 60], light: [148, 112, 80], dark: [82, 58, 42], edge: [52, 36, 28], nail: [190, 182, 170] },
    hazardA: [196, 156, 92], hazardB: [48, 40, 46],
    paintDim: [150, 132, 130], paintWarm: [216, 190, 168],
    stains: [[70, 46, 42], [78, 52, 46], [64, 42, 40]], crack: [56, 38, 34],
    metal: [126, 112, 110], metalDark: [68, 58, 58], metalHi: [184, 170, 166],
    puddle: [86, 70, 68], puddleSheen: [150, 128, 118], neon: [226, 138, 150],
    foliage: [[52, 104, 80], [68, 128, 96], [40, 84, 68]], pot: [118, 82, 66],
    rug: [126, 62, 62], rugHi: [164, 96, 88], rugLo: [88, 42, 46],
    woodDark: [58, 42, 32], woodPlank: [108, 80, 58], woodHi: [136, 104, 74],
    barrel: [104, 84, 72], barrelDark: [56, 44, 40], barrelHi: [152, 132, 114],
    lamplight: [226, 186, 132], cable: [44, 32, 30], trim: [74, 50, 42],
    slabTints: [[[255, 210, 160], 10], [[30, 14, 12], 22], [[40, 20, 16], 12]],
  },
};

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

/** palette + the textures generated from it */
export function makeArt(kind, make = defaultCanvas) {
  const p = PALETTES[kind] || PALETTES.yard;
  const art = Object.assign({}, p);
  art.floorTex = noiseTile(128, art.floorColors, art.floorBlock, art.salt, make);
  art.wallTex = noiseTile(64, art.wallTexColors, 4, art.salt + 3, make);
  art.slabTints = (p.slabTints || []).map(([c, a]) => tintTile(p.slab, c, a, make));
  art.checker = p.checker ? tintTile(p.slab, p.checker[0], p.checker[1], make) : null;
  return art;
}

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
