// Advance round-outcome scenes and enter the next round or results.
import { WIN_TARGET } from '../config.js';
import { EV } from '../net/netcode.js';
import { states } from './registry.js';

export const outcomeFlow = {
  advance() {
    if (this.done) return;
    this.index += 1;
    if (this.index < this.sequence.length) {
      this.frameI = 0;
      this.frameT = 0;
      this.autoT = 5;
      return;
    }
    this.done = true;
    this.finish();
  },

  finish() {
    const m = this.app.match;
    if (m.guy >= WIN_TARGET) {
      this.netEvent(EV.MATCH_OVER, [0]);
      this.app.state = new states.MatchOverState(this.app, 'guy');
    } else if (m.girl >= WIN_TARGET) {
      this.netEvent(EV.MATCH_OVER, [1]);
      this.app.state = new states.MatchOverState(this.app, 'girl');
    } else {
      m.round += 1;
      this.netEvent(EV.ROUND, [m.round, m.guy, m.girl]);
      this.app.state = new states.GameState(this.app);
    }
  }
};
