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
