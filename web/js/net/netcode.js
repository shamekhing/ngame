// Host-authoritative netcode over one reliable, ordered data channel.
//
//   host : runs the whole match, sends SNAP 30x/s, resolves everything
//   guest: predicts its own character, learns everything else from SNAP
//
// Both sides run the same `GameState`; the guest is pulled onto the host's
// positions a little at a time and re-plays the host's transitions (catch,
// round over, match over) from CTL events.  Packets are fixed-layout little
// endian blobs - positions use 1/16 px, so a snapshot is 26 bytes.
import { WORLD_W, WORLD_H } from '../config.js';

export const KIND = { CTL: 1, INPUT: 2, SNAP: 3 };
// CTL and EV travel in the same byte, so the two ranges must never overlap.
export const CTL = { HELLO: 0, READY: 1, EVENT: 2, PING: 3, PONG: 4, BYE: 5 };
export const EV = {
  CATCH: 16, ESCAPE: 17, ROUND: 18, NSFW: 19, MATCH_OVER: 20, REMATCH: 21, MENU: 22,
};
/**
 * Which catch scene plays for each round outcome, as an index into the shared
 * NSFW_SHEETS list (Sex1 first, Sex2 second). Travels in the EV.NSFW payload.
 */
export const WIN_SCENES = { guy: 0, girl: 1 };
export const PROTOCOL = 1;

const ACT_ACTION = 1;
const ACT_DODGE = 2;

const DIR = { up: 8, down: 4, left: 2, right: 1 };

const HOST = 'host';
const GUEST = 'guest';

// ---------------------------------------------------------------------------
// byte plumbing
// ---------------------------------------------------------------------------

class Writer {
  constructor(size = 32) {
    this.buf = new Uint8Array(size);
    this.view = new DataView(this.buf.buffer);
    this.at = 0;
  }

  _need(n) {
    if (this.at + n <= this.buf.length) return;
    const bigger = new Uint8Array(Math.max(this.buf.length * 2, this.at + n));
    bigger.set(this.buf);
    this.buf = bigger;
    this.view = new DataView(bigger.buffer);
  }

  u8(v) { this._need(1); this.view.setUint8(this.at, v & 0xff); this.at += 1; return this; }
  u16(v) { this._need(2); this.view.setUint16(this.at, Math.max(0, Math.min(65535, v | 0)), true); this.at += 2; return this; }
  i16(v) { this._need(2); this.view.setInt16(this.at, Math.max(-32768, Math.min(32767, v | 0)), true); this.at += 2; return this; }
  bytes() { return this.buf.slice(0, this.at); }
}

class Reader {
  constructor(bytes) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.at = 0;
  }

  u8() { const v = this.view.getUint8(this.at); this.at += 1; return v; }
  u16() { const v = this.view.getUint16(this.at, true); this.at += 2; return v; }
  i16() { const v = this.view.getInt16(this.at, true); this.at += 2; return v; }
}

/** world x/y -> 1/16 px u16 (and back) */
export const encPos = (v) => Math.round(Math.max(0, Math.min(WORLD_W, v)) * 16);
export const decPos = (v) => v / 16;
const encVel = (v) => Math.round(Math.max(-32000, Math.min(32000, v)));
const clampTime = (t) => Math.round(Math.max(0, Math.min(65535, t * 100)));   // 1/100 s

export function dirsFromHeld(held, mapping) {
  let bits = 0;
  if (held.has(mapping.up)) bits |= DIR.up;
  if (held.has(mapping.down)) bits |= DIR.down;
  if (held.has(mapping.left)) bits |= DIR.left;
  if (held.has(mapping.right)) bits |= DIR.right;
  return bits;
}

export function heldFromDirs(bits) {
  const held = new Set();
  if (bits & DIR.up) held.add('ArrowUp');
  if (bits & DIR.down) held.add('ArrowDown');
  if (bits & DIR.left) held.add('ArrowLeft');
  if (bits & DIR.right) held.add('ArrowRight');
  // the guest always plays P2-style keys; the state maps them per character
  return held;
}

// ---------------------------------------------------------------------------
// packets
// ---------------------------------------------------------------------------

export function encodeInput(seq, dirs, actions) {
  return new Writer(27).u8(KIND.INPUT).u16(seq & 0xffff).u8(dirs).u8(actions).bytes();
}

export function decodeInput(bytes) {
  const r = new Reader(bytes);
  if (r.u8() !== KIND.INPUT) throw new Error('not an input packet');
  return { seq: r.u16(), dirs: r.u8(), actions: r.u8() };
}

export function encodeSnapshot(seq, tick, state) {
  const w = new Writer(40).u8(KIND.SNAP).u16(seq & 0xffff).u16(tick & 0xffff);
  w.u16(clampTime(state.timeLeft));
  w.u8(state.app.match.guy).u8(state.app.match.girl).u8(state.app.match.round);
  let flags = 0;
  if (state.roundOver) flags |= 1;
  if (state.startLock > 0) flags |= 2;
  w.u8(flags);
  for (const ent of [state.guy, state.girl]) {
    w.u16(encPos(ent.x)).u16(encPos(ent.y)).i16(encVel(ent.vx)).i16(encVel(ent.vy));
  }
  return w.bytes();
}

export function decodeSnapshot(bytes) {
  const r = new Reader(bytes);
  if (r.u8() !== KIND.SNAP) throw new Error('not a snapshot');
  const snap = {
    seq: r.u16(), tick: r.u16(), timeLeft: r.u16() / 100,
    scores: { guy: r.u8(), girl: r.u8() }, round: r.u8(), flags: r.u8(), ents: [],
  };
  snap.roundOver = (snap.flags & 1) !== 0;
  snap.startLock = (snap.flags & 2) !== 0;
  for (let i = 0; i < 2; i += 1) {
    snap.ents.push({
      x: decPos(r.u16()), y: decPos(r.u16()), vx: r.i16(), vy: r.i16(),
    });
  }
  return snap;
}

export function encodeCtl(sub, values = []) {
  const w = new Writer(16).u8(KIND.CTL).u8(sub);
  for (const v of values) w.u8(v);
  return w.bytes();
}

export function decodeCtl(bytes) {
  const r = new Reader(bytes);
  if (r.u8() !== KIND.CTL) throw new Error('not a control packet');
  const sub = r.u8();
  const values = [];
  while (r.at < bytes.length) values.push(r.u8());
  return { sub, values };
}

export function kindOf(bytes) {
  return bytes.length ? bytes[0] : -1;
}

// ---------------------------------------------------------------------------
// session: one per client, drives input + snapshots every frame
// ---------------------------------------------------------------------------

const SNAP_DT = 1 / 30;
const CORRECTION = 0.18;     // how hard the guest is pulled onto the host's data
const SNAP_IF_FAR = 48;      // px of drift before we stop smoothing and jump
const EXTRAP_MAX = 0.12;     // s of dead reckoning between snapshots
const ACT_CONTINUE = 4;

export class NetSession {
  /**
   * @param {Transport} transport
   * @param {'host'|'guest'} role
   */
  constructor(transport, role, opts = {}) {
    this.t = transport;
    this.role = role;
    this.remoteKeys = new Set();     // host only: the guest's direction keys
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

  send(bytes) {
    if (this.t.connected) this.t.send(bytes);
  }

  // --- input edges ---------------------------------------------------------

  /** an action / dodge / continue edge the local player just triggered */
  queueAction(kind) {
    if (kind === 'action') this.pendingActions |= ACT_ACTION;
    else if (kind === 'dodge') this.pendingActions |= ACT_DODGE;
    else this.pendingActions |= ACT_CONTINUE;
  }

  /** tell the guest about a transition it has to re-play */
  event(sub, values = []) {
    if (this.isHost) this.send(encodeCtl(sub, values));
  }

  pingNow() {
    this.pingSentAt = Date.now();
    this.send(encodeCtl(CTL.PING));
  }

  // --- incoming ------------------------------------------------------------

  receive(bytes) {
    try {
      const kind = kindOf(bytes);
      if (kind === KIND.INPUT) this.onInput(decodeInput(bytes));
      else if (kind === KIND.SNAP) this.onSnapshot(decodeSnapshot(bytes));
      else if (kind === KIND.CTL) this.onCtl(decodeCtl(bytes));
    } catch (err) {
      this.netWarn = `dropped a bad packet: ${err.message}`;
    }
  }

  onInput(pkt) {
    if (!this.isHost || !this.state) return;
    this.remoteKeys = heldFromDirs(pkt.dirs);
    if (pkt.actions & ACT_ACTION) this.hostAction('action');
    if (pkt.actions & ACT_DODGE) this.hostAction('dodge');
    if (pkt.actions & ACT_CONTINUE) this.hostContinue();
  }

  /** the host resolves the guest's action for the character the guest owns */
  hostAction(kind) {
    const char = this.localSeat === 'p1' ? this.state.p2Char : this.state.p1Char;
    if (kind === 'action') this.state.doAction(char);
    else this.state.doDodge(char);
  }

  /** the guest pressed something on a "press any key" screen */
  hostContinue() {
    if (typeof this.state.handleKey === 'function') this.state.handleKey('Enter');
  }

  onSnapshot(snap) {
    if (this.isHost) return;
    if (this.snap && ((snap.seq - this.snap.seq) & 0xffff) > 0x8000) return;  // stale
    this.snap = snap;
    this.snapAge = 0;
  }

  onCtl(pkt) {
    if (pkt.sub === CTL.PING) { this.send(encodeCtl(CTL.PONG)); return; }
    if (pkt.sub === CTL.PONG) { this.ping = Date.now() - this.pingSentAt; return; }
    this.events.push(pkt);
  }

  // --- per-frame -----------------------------------------------------------

  /**
   * @param {number} dt
   * @param {object} app
   * @param {object} state  current state; only a GameState is simulated
   */
  poll(dt, app, state) {
    this.state = state && typeof state.doAction === 'function' ? state : null;
    this.snapAge += dt;

    if (this.isHost) {
      this.snapAcc += dt;
      if (this.snapAcc >= SNAP_DT && this.state) {
        this.snapAcc = 0;
        this.tick = (this.tick + 1) & 0xffff;
        this.send(encodeSnapshot((this.seq += 1), this.tick, this.state));
      }
    } else {
      // 60 Hz: the host wants our direction keys the moment they change
      this.inputAcc += dt;
      if (this.inputAcc >= 1 / 60) {
        this.inputAcc = 0;
        const mapping = this.state ? this.state.mappingFor(this.localSeat) : null;
        const dirs = mapping ? dirsFromHeld(app.input.held, mapping) : 0;
        this.send(encodeInput((this.seq += 1), dirs, this.pendingActions));
        this.pendingActions = 0;
      }
    }

    // re-play the host's transitions
    while (this.events.length) {
      const pkt = this.events.shift();
      if (state && typeof state.applyNetEvent === 'function') {
        state.applyNetEvent(pkt.sub, pkt.values);
      }
    }

    if (!this.isHost && this.snap && this.state) this.applySnapshot();
  }

  /** guest: pull both characters onto the host's world */
  applySnapshot() {
    const state = this.state;
    const age = Math.min(this.snapAge, EXTRAP_MAX);      // dead reckoning
    const ents = [state.guy, state.girl];
    const mine = this.localChar(state);
    for (let i = 0; i < 2; i += 1) {
      const ent = ents[i];
      const s = this.snap.ents[i];
      const ex = s.x + s.vx * age;
      const ey = s.y + s.vy * age;
      if (ent === mine) {
        // predicted locally, so only nudge - unless we have drifted badly
        if (Math.hypot(ent.x - ex, ent.y - ey) > SNAP_IF_FAR) {
          ent.setPos(ex, ey);
          ent.vx = s.vx;
          ent.vy = s.vy;
        } else {
          ent.x += (ex - ent.x) * CORRECTION;
          ent.y += (ey - ent.y) * CORRECTION;
          ent.vx += (s.vx - ent.vx) * CORRECTION;
          ent.vy += (s.vy - ent.vy) * CORRECTION;
        }
      } else {
        // the peer's character: placed straight from the host
        ent.setPos(ex, ey);
        ent.vx = s.vx;
        ent.vy = s.vy;
      }
    }
    state.timeLeft = this.snap.timeLeft;
    state.app.match.guy = this.snap.scores.guy;
    state.app.match.girl = this.snap.scores.girl;
    state.app.match.round = this.snap.round;
    if (this.snap.roundOver) state.roundOver = true;
  }

  close() {
    if (this.isHost) this.send(encodeCtl(CTL.BYE));
    this.t.close();
  }
}
