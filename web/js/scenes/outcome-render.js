// Round-outcome and match-over screen drawing.
import { WINDOW_W, WINDOW_H, FRAME, WHITE, MUTED, DANGER, GOLD, GREEN, BLUE } from '../config.js';
import { drawText, drawPreviewSprite } from './visuals.js';

export function drawOutcome(state, ctx) {
  const app = state.app;
  ctx.fillStyle = '#160a14';
  ctx.fillRect(0, 0, WINDOW_W, WINDOW_H);

  const anim = state.anim();
  if (anim) {
    const f = anim.frames[state.frameI % anim.frames.length];
    const size = FRAME * 5;
    ctx.drawImage(f.image, f.sx, f.sy, f.sw, f.sh,
      Math.round(WINDOW_W / 2 - size / 2),
      Math.round(WINDOW_H / 2 + 6 - size / 2), size, size);
  }

  ctx.fillStyle = DANGER;
  for (const [hx, hy, r, t] of state.hearts) {
    ctx.beginPath();
    ctx.arc(Math.round(hx), Math.round(hy - t * 180), Math.round(r * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }

  drawText(ctx, app, state.title, WINDOW_W / 2, 46, 44, DANGER, true, true);
  const m = app.match;
  drawText(ctx, app, `GUY ${m.guy}  |  GIRL ${m.girl}`, WINDOW_W / 2, WINDOW_H - 70, 20, WHITE, true, true);
  if (state.cur && state.cur.label) {
    drawText(ctx, app, state.cur.label, WINDOW_W / 2, WINDOW_H - 112, 18, GOLD, true);
  }

  const blink = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 600));
  const c = [154, 143, 181].map((v) => Math.round(v * blink));
  drawText(ctx, app, 'press any key to continue', WINDOW_W / 2, WINDOW_H - 36, 15,
    `rgb(${c[0]},${c[1]},${c[2]})`, true);
}

export function drawMatchOver(state, ctx) {
  const app = state.app;
  ctx.fillStyle = '#100a18';
  ctx.fillRect(0, 0, WINDOW_W, WINDOW_H);
  const guyWon = state.winner === 'guy';
  drawText(ctx, app, guyWon ? 'GUY WINS!' : 'GIRL WINS!', WINDOW_W / 2, 120, 56,
    guyWon ? BLUE : DANGER, true, true);
  drawText(ctx, app, guyWon ? 'he caught her enough times' : 'she slipped away every time',
    WINDOW_W / 2, 176, 18, MUTED, true);
  const m = app.match;
  drawText(ctx, app, `FINAL SCORE   GUY ${m.guy}  -  ${m.girl} GIRL`,
    WINDOW_W / 2, 240, 22, WHITE, true, true);

  drawPreviewSprite(ctx, state.preview, WINDOW_W / 2, 340, !guyWon, 4);

  drawText(ctx, app, '[ ENTER ] back to menu      [ SPACE ] rematch',
    WINDOW_W / 2, WINDOW_H - 50, 16, GREEN, true, true);
}
