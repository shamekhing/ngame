// Game state and fixed-step frame loop.
import { MenuState, GameState, IntroState } from './scenes.js';
import { defaultCanvas } from './arena.js';
import { Input } from './input.js';
import { frameMethods } from './app-frame.js';


export class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.roles = { p1: 'guy', p2: 'girl' };
    this.match = { guy: 0, girl: 0, round: 1 };
    this.anims = {};
    this.nsfwPool = [];
    this.state = null;
    this.acc = 0;
    this.last = 0;
    this.net = null;          // null = local 2P on one keyboard
    this.onStatus = null;     // set by boot(): status line messages
    this.makeCanvas = defaultCanvas;   // swappable so tests stay DOM-free
  }

  /** a match starts behind the control card; {intro:false} jumps straight in */
  startMatch({ intro = true } = {}) {
    if (this.onStartMatch) this.onStartMatch();
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.match = { guy: 0, girl: 0, round: 1 };
    this.state = intro ? new IntroState(this) : new GameState(this);
  }

  /** enter a round (later rounds skip the card) */
  beginRound(opts = {}) {
    this.state = new GameState(this, opts);
  }

  /** debug/test helper: jump straight into a given round's layout */
  jumpToRound(round) {
    this.match = { guy: 0, girl: 0, round };
    this.state = new GameState(this);
  }

  setState(state) { this.state = state; }

  // --- netplay -------------------------------------------------------------

  /** @param {import('./net/netcode.js').NetSession} session */
  useNet(session) {
    this.net = session;
    if (session) session.onClose = () => this.onPeerLeft();
  }

  /** drop the session (menu / disconnect), without touching the UI */
  leaveNet() {
    const net = this.net;
    this.net = null;
    if (net && net.t && net.t.connected) net.close();
  }

  /** the other side vanished: fall back to local play and say so */
  onPeerLeft() {
    this.net = null;
    if (this.onStatus) this.onStatus('the other player disconnected');
    if (this.state instanceof GameState) this.state = new MenuState(this);
  }

  /** one fixed 60 Hz tick */
  step(dt) {
    for (const code of this.input.drainPressed()) this.state.handleKey(code);
    this.state.update(dt);
    if (this.net) this.net.poll(dt, this, this.state);
  }

  
}


Object.defineProperties(App.prototype, Object.getOwnPropertyDescriptors(frameMethods));
