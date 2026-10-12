// Outbound protocol events and action edges.
import { ACT_ACTION, ACT_DODGE, CTL } from './packet-core.js';
import { encodeCtl } from './packet-codecs.js';

const ACT_CONTINUE = 4;

export const sessionsendMethods = {
  send(bytes) {
    if (this.t.connected) this.t.send(bytes);
  },

  queueAction(kind) {
    if (kind === 'action') this.pendingActions |= ACT_ACTION;
    else if (kind === 'dodge') this.pendingActions |= ACT_DODGE;
    else this.pendingActions |= ACT_CONTINUE;
  },

  event(sub, values = []) {
    if (this.isHost) this.send(encodeCtl(sub, values));
  },

  pingNow() {
    this.pingSentAt = Date.now();
    this.send(encodeCtl(CTL.PING));
  },

  close() {
    if (this.isHost) this.send(encodeCtl(CTL.BYE));
    this.t.close();
  }
};
