// Real ordered RTCDataChannel transport.
import { Transport } from './transport-base.js';

export class RTCTransport extends Transport {
  constructor(channel) {
    super();
    this.channel = channel;
    this.connected = channel.readyState === 'open';
    this.bytesIn = 0;
    this.bytesOut = 0;
    this.packetsIn = 0;
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => {
      this.connected = true;
      this.closed = false;
      if (this.onOpen) this.onOpen();
    };
    channel.onclose = () => {
      this.connected = false;
      this.closed = true;
      if (this.onClose) this.onClose();
    };
    channel.onerror = (ev) => { if (this.onError) this.onError(ev); };
    channel.onmessage = (ev) => {
      const data = ev.data;
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data)
        : data instanceof Uint8Array ? data
          : new Uint8Array(data.buffer || []);
      this.bytesIn += bytes.byteLength;
      this.packetsIn += 1;
      this._emitMessage(bytes);
    };
  }

  send(bytes) {
    if (!this.connected) throw new Error('transport not connected');
    this.bytesOut += bytes.byteLength;
    this.channel.send(bytes);
  }

  close() {
    if (this.closed) return;
    this.connected = false;
    super.close();
    try { this.channel.close(); } catch (err) { /* already gone */ }
  }
}

