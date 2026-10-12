// Pre-round control card and countdown.
import { PHASE, CARD_MS } from '../config.js';
import { State } from './base.js';
import { states } from './registry.js';
import { stepAnim } from './visuals.js';
import { drawIntro } from './menu-render.js';

export class IntroState extends State {
  constructor(app) {
    super(app);
    this.phase = PHASE.MENU;
    this.t = CARD_MS / 1000;
    this.cardGuy = { anim: app.anims['guy-idle'], t: 0, i: 0 };
    this.cardGirl = { anim: app.anims['girl-idle'], t: 0, i: 0 };
  }

  handleKey(code) {
    if (this.app.net && !this.app.net.isHost) return;    // the host drives
    if (code === 'Escape') {
      if (this.app.net) this.app.leaveNet();
      this.app.state = new states.MenuState(this.app);
    } else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
      this.begin();                                       // skip the card
    }
  }

  update(dt) {
    stepAnim(this.cardGuy, dt);
    stepAnim(this.cardGirl, dt);
    this.t -= dt;
    if (this.t <= 0) this.begin();
  }

  begin() {
    if (this.app.state !== this) return;
    this.app.beginRound({ intro: true });
  }

  /** which seats this device plays */
  seats() {
    const net = this.app.net;
    return net ? [net.localSeat] : ['p1', 'p2'];
  }

  draw(ctx) { drawIntro(this, ctx); }

}
