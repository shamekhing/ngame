// Non-blocking arena props and shape helpers.
import { rgb, R, dot, hline, vline, rnd, pick, shade, defaultCanvas, glow } from './primitives.js';

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

