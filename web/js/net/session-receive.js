// Incoming packets and host action resolution.
import { ACT_ACTION, ACT_DODGE, KIND, CTL, heldFromDirs } from './packet-core.js';
import { kindOf, decodeInput, decodeSnapshot, decodeCtl, encodeCtl } from './packet-codecs.js';

const ACT_CONTINUE = 4;

export const sessionreceiveMethods = {
  receive(bytes) {
    try {
      const kind = kindOf(bytes);
      if (kind === KIND.INPUT) this.onInput(decodeInput(bytes));
      else if (kind === KIND.SNAP) this.onSnapshot(decodeSnapshot(bytes));
      else if (kind === KIND.CTL) this.onCtl(decodeCtl(bytes));
    } catch (err) {
      this.netWarn = `dropped a bad packet: ${err.message}`;
    }
  },

  onInput(pkt) {
    if (!this.isHost || !this.state) return;
    this.remoteKeys = heldFromDirs(pkt.dirs);
    this.remoteAxis = pkt.axis || null;
    if (pkt.actions & ACT_ACTION) this.hostAction('action');
    if (pkt.actions & ACT_DODGE) this.hostAction('dodge');
    if (pkt.actions & ACT_CONTINUE) this.hostContinue();
  },

  hostAction(kind) {
    const char = this.localSeat === 'p1' ? this.state.p2Char : this.state.p1Char;
    if (kind === 'action') this.state.doAction(char);
    else this.state.doDodge(char);
  },

  hostContinue() {
    if (typeof this.state.handleKey === 'function') this.state.handleKey('Enter');
  },

  onSnapshot(snap) {
    if (this.isHost) return;
    if (this.snap && ((snap.seq - this.snap.seq) & 0xffff) > 0x8000) return;  // stale
    this.snap = snap;
    this.snapAge = 0;
  },

  onCtl(pkt) {
    if (pkt.sub === CTL.PING) { this.send(encodeCtl(CTL.PONG)); return; }
    if (pkt.sub === CTL.PONG) { this.ping = Date.now() - this.pingSentAt; return; }
    this.events.push(pkt);
  }
};
