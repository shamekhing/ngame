// Offer/answer exchange and WebRTC connection lifecycle.
import { encodeCode, decodeCode } from './signaling-code.js';

const CHANNEL = 'ctg';
const DEFAULT_ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

export class ManualSignaler {
  /**
   * @param {object} [opts]
   * @param {Array}  [opts.iceServers] STUN/TURN config (empty = LAN only)
   * @param {number} [opts.gatherTimeout] ms to wait for all ICE candidates
   * @param {Function} [opts.onChannel] called with the open RTCDataChannel
   */
  constructor(opts = {}) {
    this.iceServers = opts.iceServers || DEFAULT_ICE;
    this.gatherTimeout = opts.gatherTimeout || 15000;
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
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        pc.removeEventListener('icegatheringstatechange', onChange);
        clearTimeout(timer);
      };
      const onChange = () => {
        if (pc.iceGatheringState === 'complete') { cleanup(); resolve(); }
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('network address gathering timed out; try another network'));
      }, this.gatherTimeout);
      pc.addEventListener('icegatheringstatechange', onChange);
      onChange();
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
