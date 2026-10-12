// Final score and rematch/menu controls.
import { PHASE } from '../config.js';
import { EV } from '../net/netcode.js';
import { State } from './base.js';
import { states } from './registry.js';
import { forwardKey } from './transitions.js';
import { stepAnim } from './visuals.js';
import { drawMatchOver } from './outcome-render.js';

export class MatchOverState extends State {
  constructor(app, winner) {
    super(app);
    this.phase = PHASE.MATCHOVER;
    this.winner = winner;
    this.preview = {
      anim: app.anims[winner === 'guy' ? 'guy-walk' : 'girl-run'], t: 0, i: 0,
    };
  }

  handleKey(code) {
    if (forwardKey(this.app)) return;              // the host picks for both of us
    if (code === 'Enter' || code === 'NumpadEnter') {
      this.app.state = new states.MenuState(this.app);
      if (this.app.net) this.app.net.event(EV.MENU);
    } else if (code === 'Space') {
      this.app.startMatch();
      if (this.app.net) this.app.net.event(EV.ROUND, [1, 0, 0, 1]);
    }
  }

  update(dt) { stepAnim(this.preview, dt); }

  draw(ctx) { drawMatchOver(this, ctx); }
}
