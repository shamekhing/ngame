// Arena view, characters, effects, and HUD for GameState.
import { WINDOW_W, WINDOW_H, WORLD_W, WORLD_H, FRAME, DANGER } from '../config.js';
import { drawText } from './visuals.js';
import { drawHud } from './game-hud.js';

export function drawGame(state, ctx) {
  const ox = state.shakeT > 0 ? Math.round(Math.random() * 8 - 4) : 0;
  const oy = state.shakeT > 0 ? Math.round(Math.random() * 8 - 4) : 0;
  const cam = state.camera;

  drawArena(state, ctx, ox, oy);

  const ents = [state.guy, state.girl].sort((a, b) => a.y - b.y);
  for (const ent of ents) {
    const { frame, flip } = ent.currentFrame();
    const size = Math.round(FRAME * cam.zoom);
    const half = Math.round(size / 2);
    const [sx, sy] = cam.toScreen(ent.x, ent.y);
    ctx.save();
    ctx.translate(Math.round(sx + ox), Math.round(sy + oy));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(frame.image, frame.sx, frame.sy, frame.sw, frame.sh,
                  -half, -half, size, size);
    ctx.restore();
  }
  drawSense(state, ctx, ox, oy);

  for (const p of state.popups) {
    const prog = 1 - p.t / 0.75;
    const [sx, sy] = cam.toScreen(p.x, p.y0 - prog * 34);
    ctx.globalAlpha = Math.max(0, p.t / 0.75);
    drawText(ctx, state.app, p.text, sx + ox, sy + oy, 18, p.color, true, true);
    ctx.globalAlpha = 1;
  }

  ctx.drawImage(state.arena.vignette, 0, 0);   // moody edges, HUD stays readable
  drawHud(state, ctx);
}

// The painted world slice is blitted through the camera transform.
function drawArena(state, ctx, ox, oy) {
const cam = state.camera;
const vw = WINDOW_W / cam.zoom;
const vh = WINDOW_H / cam.zoom;
const left = Math.min(Math.max(cam.center[0] - vw / 2, 0), WORLD_W - vw);
const top = Math.min(Math.max(cam.center[1] - vh / 2, 0), WORLD_H - vh);
const sx = Math.trunc(left);
const sy = Math.trunc(top);
const sw = Math.min(Math.max(1, Math.round(vw)), WORLD_W - sx);
const sh = Math.min(Math.max(1, Math.round(vh)), WORLD_H - sy);
ctx.drawImage(state.arena.surface, sx, sy, sw, sh,
  Math.round(ox - (sx - left) * cam.zoom), Math.round(oy - (sy - top) * cam.zoom),
  WINDOW_W, WINDOW_H);
}

/** the girl's "someone is close" sense: a pulsing bang above her head */
function drawSense(state, ctx, ox, oy) {
const girl = state.girl;
if (!girl.sense || girl.locked) return;
const cam = state.camera;
const [sx, sy] = cam.toScreen(girl.x, girl.y);
const r = Math.max(5, Math.round(7 * cam.zoom));
const y = sy + oy - Math.round(34 * cam.zoom);
const pulse = 0.55 + 0.45 * Math.sin(state.elapsed * 9);
ctx.save();
ctx.globalAlpha = pulse;
ctx.fillStyle = DANGER;
ctx.beginPath();
ctx.arc(Math.round(sx + ox), y, r, 0, Math.PI * 2);
ctx.fill();
ctx.restore();
drawText(ctx, state.app, '!', sx + ox, y + r * 0.42, Math.round(r * 1.7), '#1a1426', true, true);
}

