// Shared text and preview-sprite drawing.
import { FRAME, WHITE } from '../config.js';

export function drawText(ctx, app, text, x, y, size = 18, color = WHITE, center = false, bold = false) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px monospace`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const w = ctx.measureText(text).width;
  const left = center ? x - w / 2 : x;
  const baseline = center ? y + size * 0.35 : y + size * 0.8;
  ctx.fillText(text, Math.round(left), Math.round(baseline));
  return w;
}

export function drawPreviewSprite(ctx, preview, x, y, flip, scale = 1) {
  const frame = preview.anim.frames[preview.i];
  const size = FRAME * scale;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(frame.image, frame.sx, frame.sy, frame.sw, frame.sh,
    -size / 2, -size / 2, size, size);
  ctx.restore();
}

/** advance any {anim, t, i} preview player */
export function stepAnim(p, dt) {
  const spf = 1 / p.anim.fps;
  p.t += dt;
  while (p.t >= spf) { p.t -= spf; p.i = (p.i + 1) % p.anim.frames.length; }
}

