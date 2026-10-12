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

export const ACT_ACTION = 1;
export const ACT_DODGE = 2;

export const DIR = { up: 8, down: 4, left: 2, right: 1 };

// ---------------------------------------------------------------------------
// byte plumbing
// ---------------------------------------------------------------------------

export class Writer {
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
  i8(v) { this._need(1); this.view.setInt8(this.at, Math.max(-127, Math.min(127, v | 0))); this.at += 1; return this; }
  u16(v) { this._need(2); this.view.setUint16(this.at, Math.max(0, Math.min(65535, v | 0)), true); this.at += 2; return this; }
  i16(v) { this._need(2); this.view.setInt16(this.at, Math.max(-32768, Math.min(32767, v | 0)), true); this.at += 2; return this; }
  bytes() { return this.buf.slice(0, this.at); }
}

export class Reader {
  constructor(bytes) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.at = 0;
  }

  u8() { const v = this.view.getUint8(this.at); this.at += 1; return v; }
  i8() { const v = this.view.getInt8(this.at); this.at += 1; return v; }
  u16() { const v = this.view.getUint16(this.at, true); this.at += 2; return v; }
  i16() { const v = this.view.getInt16(this.at, true); this.at += 2; return v; }
}

/** world x/y -> 1/16 px u16 (and back) */
export const encPos = (v) => Math.round(Math.max(0, Math.min(WORLD_W, v)) * 16);
export const decPos = (v) => v / 16;
export const encVel = (v) => Math.round(Math.max(-32000, Math.min(32000, v)));
export const clampTime = (t) => Math.round(Math.max(0, Math.min(65535, t * 100)));   // 1/100 s

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

