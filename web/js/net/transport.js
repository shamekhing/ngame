// Byte-level transport used by the netcode.
//
// Two implementations share one tiny interface so every netcode path can be
// exercised headlessly over LoopbackTransport while the browser uses a real
// RTCDataChannel.  Ordering is guaranteed by the channel (ordered, reliable),
// so the netcode itself never has to reorder or retransmit.
//
//   const t = new LoopbackTransport();
//   t.send(new Uint8Array([1, 2, 3]));
//   t.onMessage = (bytes) => { ... };
//   t.onOpen / t.onClose
export class Transport {
  constructor() {
    this.onMessage = null;    // (Uint8Array) => void
    this.onOpen = null;       // () => void
    this.onClose = null;      // () => void
    this.onError = null;      // (Error) => void
    this.closed = false;
    this.connected = false;
  }

  send(_bytes) { throw new Error('send() not implemented'); }

  close() { this.closed = true; }

  _emitMessage(bytes) {
    if (!this.closed && this.onMessage) this.onMessage(bytes);
  }
}

/** Wraps a real RTCDataChannel (ordered + reliable, so nothing is reordered) */
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

export class LoopbackTransport extends Transport {
  constructor() {
    super();
    this.peer = null;
    this.connected = false;
    this.delivered = 0;
  }

  /** wire two endpoints together */
  static pair() {
    const a = new LoopbackTransport();
    const b = new LoopbackTransport();
    a.peer = b;
    b.peer = a;
    a.connect();
    b.connect();
    return [a, b];
  }

  connect() {
    this.connected = true;
    this.closed = false;
    if (this.onOpen) this.onOpen();
  }

  send(bytes) {
    if (!this.connected) throw new Error('transport not connected');
    const peer = this.peer;
    this.delivered += 1;
    // deliver asynchronously so both sides see the same ordering semantics
    // as a real data channel (never re-entrant inside send()).
    queueMicrotask(() => { if (peer) peer._emitMessage(bytes); });
  }

  close() {
    if (this.closed) return;
    this.connected = false;
    super.close();
    if (this.onClose) this.onClose();
    const peer = this.peer;
    if (peer && !peer.closed) {
      peer.connected = false;
      peer.closed = true;
      if (peer.onClose) peer.onClose();
    }
  }
}
