// Cached glow and dithered light.
import { rgb, defaultCanvas } from './pixel-core.js';
import { blitTiled } from './textures.js';

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

