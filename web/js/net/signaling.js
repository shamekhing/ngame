// Serverless WebRTC handshake ("manual signalling").
//
// The two players swap a single text code out of band - chat, mail, a sticky
// note - so no signalling server, account or build step is involved, and the
// page works from a static host or even file://.  The code is the ICE-complete
// SDP, deflated and base64url-encoded:
//
//     host : createOffer()            -> code  (send to the guest)
//     guest: joinWith(hostCode)       -> code  (send back to the host)
//     host : accept(guestCode)        -> data channel opens
//
// STUN only helps discover a public address; two players on the same LAN
// connect without it.
const TAG = 'ctg1';
const CHANNEL = 'ctg';
const DEFAULT_ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

function bytesToB64url(bytes) {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(code) {
  const s = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}

async function pump(stream, chunk) {
  const writer = stream.writable.getWriter();
  writer.write(chunk);
  writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

/** SDP -> short copy/pasteable code (deflated when the browser supports it) */
export async function encodeCode(desc) {
  const json = JSON.stringify({ v: 1, k: desc.type, s: desc.sdp });
  const raw = new TextEncoder().encode(json);
  if (typeof CompressionStream === 'function') {
    return `${TAG}d.${bytesToB64url(await pump(new CompressionStream('deflate-raw'), raw))}`;
  }
  return `${TAG}.${bytesToB64url(raw)}`;
}

/** code -> { type, sdp } */
export async function decodeCode(code) {
  const text = String(code || '').trim().replace(/\s+/g, '');
  const dot = text.indexOf('.');
  if (dot < 0) throw new Error('that does not look like a code');
  const tag = text.slice(0, dot);
  const body = text.slice(dot + 1);
  if (tag !== TAG && tag !== `${TAG}d`) throw new Error('unknown code version');
  let bytes = b64urlToBytes(body);
  if (tag === `${TAG}d`) {
    if (typeof DecompressionStream !== 'function') throw new Error('this browser cannot read that code');
    bytes = await pump(new DecompressionStream('deflate-raw'), bytes);
  }
  const payload = JSON.parse(new TextDecoder().decode(bytes));
  if (payload.v !== 1 || typeof payload.s !== 'string') throw new Error('malformed code');
  return { type: payload.k, sdp: payload.s };
}

export class ManualSignaler {
  /**
   * @param {object} [opts]
   * @param {Array}  [opts.iceServers] STUN/TURN config (empty = LAN only)
   * @param {number} [opts.gatherTimeout] ms to wait for ICE before giving up
   * @param {Function} [opts.onChannel] called with the open RTCDataChannel
   */
  constructor(opts = {}) {
    this.iceServers = opts.iceServers || DEFAULT_ICE;
    this.gatherTimeout = opts.gatherTimeout || 2500;
    this.onChannel = opts.onChannel || null;
    this.onState = opts.onState || null;
    this.pc = null;
    this.channel = null;
  }

  _peer() {
    if (!this.pc) {
      this.pc = new RTCPeerConnection({ iceServers: this.iceServers });
      this.pc.onconnectionstatechange = () => {
        if (this.onState) this.onState(this.pc.connectionState);
      };
      this.pc.ondatachannel = (ev) => this._adopt(ev.channel);
    }
    return this.pc;
  }

  _adopt(channel) {
    this.channel = channel;
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => { if (this.onChannel) this.onChannel(channel); };
  }

  /** resolves once ICE gathering settles (or the timeout fires) */
  _iceComplete() {
    const pc = this._peer();
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        pc.removeEventListener('icegatheringstatechange', onChange);
        clearTimeout(timer);
        resolve();
      };
      const onChange = () => { if (pc.iceGatheringState === 'complete') done(); };
      const timer = setTimeout(done, this.gatherTimeout);
      pc.addEventListener('icegatheringstatechange', onChange);
    });
  }

  /** host: returns the code to hand to the guest */
  async createOffer() {
    const pc = this._peer();
    this._adopt(pc.createDataChannel(CHANNEL, { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    await this._iceComplete();
    return encodeCode(pc.localDescription);
  }

  /** guest: consumes the host code and returns the answer code */
  async joinWith(hostCode) {
    const pc = this._peer();
    await pc.setRemoteDescription(await decodeCode(hostCode));
    await pc.setLocalDescription(await pc.createAnswer());
    await this._iceComplete();
    return encodeCode(pc.localDescription);
  }

  /** host: consumes the answer code, connection comes up on its own */
  async accept(answerCode) {
    await this._peer().setRemoteDescription(await decodeCode(answerCode));
  }

  close() {
    if (this.channel) this.channel.close();
    if (this.pc) this.pc.close();
    this.pc = null;
    this.channel = null;
  }
}
