// Score, time, cooldown bars, and control hints.
import { WINDOW_W, WINDOW_H, WIN_TARGET, SLAP_COOLDOWN_MS, DODGE_COOLDOWN_MS, WHITE, MUTED, DANGER, GOLD, BLUE } from '../config.js';
import { drawText } from './visuals.js';

export function drawHud(state, ctx) {
const app = state.app;
const m = app.match;
drawText(ctx, app, `GUY ${m.guy}   |   GIRL ${m.girl}`, 16, 12, 18, WHITE, false, true);
drawText(ctx, app, `ROUND ${m.round}  (${state.layoutName})   -   first to ${WIN_TARGET}`,
  16, 38, 14, MUTED);
drawText(ctx, app, `TIME ${Math.ceil(state.timeLeft)}`, WINDOW_W / 2, 22, 30, GOLD, true, true);

const bx = WINDOW_W - 16 - 160;
drawText(ctx, app, 'SLAP', bx, WINDOW_H - 60, 12, '#ff9ec4', false, true);
ctx.fillStyle = '#332244';
ctx.fillRect(bx, WINDOW_H - 46, 160, 10);
ctx.fillStyle = DANGER;
ctx.fillRect(bx, WINDOW_H - 46,
  160 * (1 - state.girl.cooldownFraction(state.elapsed, SLAP_COOLDOWN_MS)), 10);
drawText(ctx, app, 'DODGE', bx, WINDOW_H - 30, 12, BLUE, false, true);
ctx.fillStyle = '#222c44';
ctx.fillRect(bx, WINDOW_H - 16, 160, 10);
ctx.fillStyle = BLUE;
ctx.fillRect(bx, WINDOW_H - 16,
  160 * (1 - state.girl.dodgeFraction(state.elapsed, DODGE_COOLDOWN_MS)), 10);

const hint = app.isTouch && app.net
  ? 'DRAG JOYSTICK TO MOVE   |   DODGE AND ACTION ON THE RIGHT'
  : app.isTouch
    ? 'P1 KEYBOARD   |   P2 JOYSTICK + DODGE + ACTION'
    : app.roles.p1 === 'guy'
  ? 'P1 WASD+F = GUY (F to grab)   |   P2 Arrows+Space = GIRL (Space slap, RSHIFT dodge)'
  : 'P1 WASD+F = GIRL (F slap, LSHIFT dodge)   |   P2 Arrows+Space = GUY (Space to grab)';
drawText(ctx, app, hint, 16, WINDOW_H - 26, 13, MUTED);

if (state.banner) {
  const cx = WINDOW_W / 2;
  const cy = WINDOW_H / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.63)';
  ctx.fillRect(cx - 270, cy - 60, 540, 120);
  drawText(ctx, app, state.banner.title, cx, cy - 18, 40, WHITE, true, true);
  drawText(ctx, app, state.banner.sub, cx, cy + 28, 18, GOLD, true);
}
}
