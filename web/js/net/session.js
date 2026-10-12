// Multiplayer session state and focused method groups.
import { sessionsendMethods } from './session-send.js';
import { sessionreceiveMethods } from './session-receive.js';
import { sessionpollMethods } from './session-poll.js';
import { sessionsnapshotMethods } from './session-snapshot.js';

export class NetSession {
  constructor(transport, role, opts = {}) {
    this.t = transport;
    this.role = role;
    this.remoteKeys = new Set();     // host only: the guest's direction keys
    this.remoteAxis = null;          // host only: analog joystick, when active
    this.pendingActions = 0;         // guest only: edges waiting for the next packet
    this.seq = 0;
    this.tick = 0;
    this.snapAcc = 0;
    this.inputAcc = 0;
    this.state = null;
    this.snap = null;
    this.snapAge = 0;
    this.ping = null;
    this.pingSentAt = 0;
    this.events = [];
    this.netWarn = null;
    this.onStatus = opts.onStatus || null;
    this.onClose = opts.onClose || null;
    this.t.onMessage = (bytes) => this.receive(bytes);
    this.t.onClose = () => { if (this.onClose) this.onClose(); };
  }

  get isHost() { return this.role === 'host'; }

  get localSeat() { return this.isHost ? 'p1' : 'p2'; }

  get active() { return true; }

  localChar(state) { return this.localSeat === 'p1' ? state.p1Char : state.p2Char; }

}

for (const methods of [sessionsendMethods, sessionreceiveMethods, sessionpollMethods, sessionsnapshotMethods]) {
  Object.defineProperties(NetSession.prototype, Object.getOwnPropertyDescriptors(methods));
}
