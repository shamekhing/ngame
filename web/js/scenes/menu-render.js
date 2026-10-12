// Main menu and pre-round control-card drawing.
import { WINDOW_W, WINDOW_H, P1_KEYS, P2_KEYS, WHITE, MUTED, DANGER, GOLD, GREEN } from '../config.js';
import { drawText, drawPreviewSprite } from './visuals.js';

const KEY_LABELS = {
  KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyF: 'F',
  ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT',
};

/** the controls of one seat, as shown on its own device before a match */
function controlLines(seat, roles, touch = false) {
  const keys = seat === 'p1' ? P1_KEYS : P2_KEYS;
  const who = roles[seat];
  const slot = seat === 'p1' ? 'PLAYER 1' : 'PLAYER 2';
  return [
    slot,
    ['MOVE', touch ? 'JOYSTICK' : [keys.up, keys.left, keys.down, keys.right]
      .map((k) => KEY_LABELS[k] || k).join(' ')],
    ['ACTION', touch ? `BUTTON (${who === 'guy' ? 'grab' : 'slap'})`
      : `${KEY_LABELS[keys.action]} (${who === 'guy' ? 'grab' : 'slap'})`],
    ['DODGE', touch ? 'BUTTON' : KEY_LABELS[keys.dodge]],
  ];
}

export function drawMenu(state, ctx) {
  const app = state.app;
  ctx.fillStyle = '#120c1e';
  ctx.fillRect(0, 0, WINDOW_W, WINDOW_H);
  const cx = WINDOW_W / 2;

  drawText(ctx, app, 'CATCH THE GIRL', cx, 96, 60, WHITE, true, true);
  drawText(ctx, app, 'a top-down chase for two', cx, 140, 17, MUTED, true);

  const picks = state.picks();
  for (const pick of picks) {
    const chosen = app.roles.p1 === pick.who;
    ctx.fillStyle = chosen ? '#241a3d' : '#171227';
    state.roundRect(ctx, pick.x - 92, 196, 184, 214, 14);
    ctx.fill();
    ctx.strokeStyle = chosen ? GOLD : '#2a2140';
    ctx.lineWidth = chosen ? 3 : 2;
    state.roundRect(ctx, pick.x - 92, 196, 184, 214, 14);
    ctx.stroke();

    ctx.save();
    if (chosen) {
      const w = 0.5 + 0.5 * Math.sin(state.pulse * Math.PI * 2);
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 18 + 12 * w;
    } else {
      ctx.globalAlpha = 0.45;
    }
    drawPreviewSprite(ctx, pick.p, pick.x, 303, pick.flip, 3);
    ctx.restore();

    drawText(ctx, app, pick.who.toUpperCase(), pick.x, 396, 17,
      chosen ? GOLD : MUTED, true, chosen);
    if (chosen) drawText(ctx, app, 'YOU PLAY', pick.x, 182, 13, GOLD, true, true);
  }

  drawText(ctx, app, 'tap a character to pick yours', cx, 466, 15, MUTED, true);
  drawText(ctx, app, 'press ENTER to play here - or host / join below', cx, 494, 15, GREEN, true);
}

export function drawIntro(state, ctx) {
  const app = state.app;
  ctx.fillStyle = '#120c1e';
  ctx.fillRect(0, 0, WINDOW_W, WINDOW_H);
  const cx = WINDOW_W / 2;

  drawText(ctx, app, `ROUND ${app.match.round}`, cx, 62, 30, DANGER, true, true);

  const seats = state.seats();
  const cols = seats.length === 1 ? [cx] : [cx - 200, cx + 200];
  seats.forEach((seat, i) => {
    const x = cols[i];
    const touchSeat = app.isTouch && (app.net ? app.net.localSeat : 'p2');
    const lines = controlLines(seat, app.roles, seat === touchSeat);
    const picked = app.roles[seat];
    const card = picked === 'guy' ? state.cardGuy : state.cardGirl;
    drawPreviewSprite(ctx, card, x, 152, picked === 'girl', 2);

    drawText(ctx, app, `YOU PLAY ${picked.toUpperCase()}`, x, 216, 16, GOLD, true, true);
    lines.slice(1).forEach((row, r) => {
      drawText(ctx, app, row[0], x - 136, 260 + r * 30, 14, MUTED, false, true);
      drawText(ctx, app, row[1], x - 4, 260 + r * 30, 16, WHITE, false, true);
    });
  });

  const go = state.t <= 0.55;
  const num = Math.max(1, Math.ceil(state.t));
  drawText(ctx, app, go ? 'GO!' : String(num), cx, 448, 76, go ? GREEN : WHITE, true, true);
  drawText(ctx, app, 'enter skips', cx, 510, 13, MUTED, true);
}
