// Character selection state.
import { WINDOW_W, PHASE } from '../config.js';
import { EV } from '../net/netcode.js';
import { State } from './base.js';
import { states } from './registry.js';
import { stepAnim } from './visuals.js';
import { drawMenu } from './menu-render.js';

export class MenuState extends State {
  constructor(app) {
    super(app);
    this.phase = PHASE.MENU;
    this.previewGuy = { anim: app.anims['guy-walk'], t: 0, i: 0 };
    this.previewGirl = { anim: app.anims['girl-run'], t: 0, i: 0 };
    this.pulse = 0;
  }

  handleKey(code) {
    if (code === 'KeyR') {
      this.pickCharacter(this.app.roles.p1 === 'guy' ? 'girl' : 'guy');
    } else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
      if (this.app.net && !this.app.net.isHost) return;   // the host starts the match
      this.app.startMatch();
      if (this.app.net) this.app.net.event(EV.ROUND, [1, 0, 0, 1]);
    }
  }

  /** the host (or a local player) picks the character they play */
  pickCharacter(who) {
    if (this.app.net && !this.app.net.isHost) return;      // only the host picks
    this.app.roles = { p1: who, p2: who === 'guy' ? 'girl' : 'guy' };
    if (this.onRoles) this.onRoles(this.app.roles);
  }

  /** the two character cards drawn on the menu; they double as the picker */
  picks() {
    const cx = WINDOW_W / 2;
    return [
      { who: 'guy', p: this.previewGuy, x: cx - 150, flip: false },
      { who: 'girl', p: this.previewGirl, x: cx + 150, flip: true },
    ];
  }

  /** canvas click/tap: pick the character whose card was hit */
  handleClick(x, y) {
    for (const pick of this.picks()) {
      if (x >= pick.x - 92 && x <= pick.x + 92 && y >= 196 && y <= 410) {
        this.pickCharacter(pick.who);
        return;
      }
    }
  }

  update(dt) {
    stepAnim(this.previewGuy, dt);
    stepAnim(this.previewGirl, dt);
    this.pulse = (this.pulse + dt) % 1;
  }

  /** title + the two characters; hosting/joining buttons live in the page */
  draw(ctx) { drawMenu(this, ctx); }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

}
