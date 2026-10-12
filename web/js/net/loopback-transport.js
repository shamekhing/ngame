// In-memory transport used by tests.
import { Transport } from './transport-base.js';

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
