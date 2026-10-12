// Tiles and block shadows.
import { rgb, pick, defaultCanvas } from './pixel-core.js';

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

