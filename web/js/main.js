// Boot + fixed-timestep loop (60 Hz update, draw every animation frame).
import { WINDOW_W, WINDOW_H, FPS, TITLE, P1_KEYS, P2_KEYS } from './config.js';
import { buildAssets } from './assets.js';
import { MenuState, GameState, IntroState, MatchOverState } from './scenes.js';
import { defaultCanvas } from './arena.js';
import { ManualSignaler } from './net/signaling.js';
import { RTCTransport } from './net/transport.js';
import { NetSession } from './net/netcode.js';

const STEP = 1 / FPS;

class Input {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();   // codes pressed since the last step
  }

  attach(target) {
    const swallow = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
    target.addEventListener('keydown', (e) => {
      if (e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName))) return;
      if (swallow.has(e.code)) e.preventDefault();
      if (!this.held.has(e.code)) this.pressed.add(e.code);
      this.held.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.held.delete(e.code));
    target.addEventListener('blur', () => this.held.clear());
  }

  drainPressed() {
    const out = [...this.pressed];
    this.pressed.clear();
    return out;
  }

  /** the on-screen buttons feed the same pipeline as the keyboard */
  setVirtual(code, down) {
    if (down) {
      if (!this.held.has(code)) this.pressed.add(code);
      this.held.add(code);
    } else {
      this.held.delete(code);
    }
  }
}

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

  frame(now) {
    const dt = Math.min((now - this.last) / 1000 || 0, 0.05);
    this.last = now;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 5) {
      this.step(STEP);
      this.acc -= STEP;
      steps += 1;
    }
    if (steps === 5) this.acc = 0;      // gave up catching up; drop the backlog

    this.state.draw(this.ctx);
    if (this.onChrome) this.onChrome(this.state);
    requestAnimationFrame((t) => this.frame(t));
  }
}

function fitCanvas(canvas, padVisible) {
  const reserve = padVisible ? 250 : 100;
  const appWidth = document.querySelector('.app').clientWidth;
  const scale = Math.min(
    (Math.min(window.innerWidth - 28, appWidth - 28)) / WINDOW_W,
    Math.max(100, window.innerHeight - reserve) / WINDOW_H,
  );
  canvas.style.width = `${Math.round(WINDOW_W * scale)}px`;
  canvas.style.height = `${Math.round(WINDOW_H * scale)}px`;
}

/**
 * Minimal serverless lobby: the two players swap one code each way, then the
 * browsers talk directly over a single ordered data channel.
 */
export function setupLobby(app, status) {
  const el = (id) => document.getElementById(id);
  const io = el('lobby-io');
  const ourField = el('ourField');
  const ourLabel = el('ourLabel');
  const ourCode = el('ourCode');
  const copyBtn = el('copyBtn');
  const theirField = el('theirField');
  const theirLabel = el('theirLabel');
  const theirCode = el('theirCode');
  const useBtn = el('useBtn');
  const leaveBtn = el('leaveBtn');
  const backBtn = el('backBtn');
  const startBtn = el('startBtn');
  const actions = document.querySelector('.actions');
  const localBtn = el('localBtn');
  const title = el('exchangeTitle');
  const menu = el('menu');
  const stateEl = el('lobbyState');

  let signaler = null;
  let mode = null;              // 'host' | 'join'
  let poll = null;

  const say = (text, isErr = false) => {
    stateEl.textContent = text || '';
    stateEl.classList.toggle('err', !!isErr);
  };

  const reset = () => {
    if (poll) { clearInterval(poll); poll = null; }
    if (signaler) { signaler.close(); signaler = null; }
    app.leaveNet();
    mode = null;
    io.hidden = true;
    menu.classList.remove('is-exchanging');
    actions.hidden = false;
    localBtn.hidden = false;
    ourField.hidden = true;
    theirField.hidden = false;
    copyBtn.hidden = true;
    leaveBtn.hidden = true;
    startBtn.hidden = true;
    useBtn.hidden = false;
    useBtn.disabled = true;
    ourLabel.textContent = 'Share your code';
    theirLabel.textContent = 'Enter their code';
    ourCode.value = '';
    theirCode.value = '';
    say('');
  };

  /** the data channel is open: hand the game a session */
  function connected(channel) {
    const transport = new RTCTransport(channel);
    const session = new NetSession(transport, mode === 'host' ? 'host' : 'guest');
    app.useNet(session);
    // the codes are spent; leave nothing but the way out
    ourField.hidden = true;
    theirField.hidden = true;
    useBtn.hidden = true;
    leaveBtn.hidden = false;
    backBtn.hidden = true;
    startBtn.hidden = mode !== 'host';
    if (status) status.textContent = '';
    say(mode === 'host' ? 'Connected. Start when both players are ready.'
      : 'connected - the host starts the match');
    poll = setInterval(() => {
      if (app.net !== session) { clearInterval(poll); poll = null; return; }
      session.pingNow();
      const ms = session.ping === null ? '?' : Math.round(session.ping);
      const kb = (transport.bytesIn / 1024).toFixed(1);
      say(`online - ping ${ms} ms - ${kb} KB in - round ${app.match.round}`);
    }, 1000);
  }

  async function start(nextMode) {
    reset();
    mode = nextMode;
    io.hidden = false;
    menu.classList.add('is-exchanging');
    actions.hidden = true;
    localBtn.hidden = true;
    backBtn.hidden = false;
    title.textContent = mode === 'host' ? 'Host a match' : 'Join a match';
    signaler = new ManualSignaler({ onChannel: connected });
    try {
      if (mode === 'host') {
        ourField.hidden = false;
        copyBtn.hidden = false;
        ourLabel.textContent = '1. Send this code';
        theirLabel.textContent = '2. Paste their reply';
        ourCode.value = 'gathering network addresses...';
        ourCode.value = await signaler.createOffer();
        say('send your code, then paste theirs below');
      } else {
        theirLabel.textContent = "Paste the host's code";
        say('paste the host\'s code above, then press "Use their code"');
      }
    } catch (err) {
      say(`could not start: ${err.message}`, true);
    }
  }

  async function useTheirCode() {
    if (!signaler || !mode) return;
    const code = theirCode.value.trim();
    if (!code) { say('paste their code first', true); return; }
    useBtn.disabled = true;
    try {
      if (mode === 'host') {
        await signaler.accept(code);
        say('connecting...');
      } else {
        ourCode.value = 'building the reply...';
        ourCode.value = await signaler.joinWith(code);
        ourField.hidden = false;            // step 2 only exists once there is a reply
        copyBtn.hidden = false;
        ourLabel.textContent = '2. Send this reply';
        say('send your reply - the host pastes it on their side');
      }
    } catch (err) {
      useBtn.disabled = false;
      say(`that code did not work: ${err.message}`, true);
    }
  }

  el('hostBtn').addEventListener('click', () => { start('host'); });
  el('joinBtn').addEventListener('click', () => { start('join'); });
  leaveBtn.addEventListener('click', () => { reset(); });
  backBtn.addEventListener('click', () => { reset(); });
  startBtn.addEventListener('click', () => {
    if (mode === 'host' && app.net && app.net.isHost && app.state instanceof MenuState) {
      app.state.handleKey('Enter');
    }
  });
  useBtn.addEventListener('click', () => { useTheirCode(); });
  el('copyBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(ourCode.value);
      say('copied - send it to the other player');
    } catch (err) {
      ourCode.select();
      say('press Ctrl+C to copy your code');
    }
  });
  theirCode.addEventListener('input', () => {
    useBtn.disabled = theirCode.value.trim().length === 0;
  });

  return { reset, start, connected };
}

export async function boot() {
  document.title = TITLE;
  const canvas = document.getElementById('game');
  canvas.width = WINDOW_W;
  canvas.height = WINDOW_H;
  const status = document.getElementById('status');

  const app = new App(canvas);
  app.ctx.imageSmoothingEnabled = false;
  window.__game = app;          // exposed early so headless checks can watch it boot

  try {
    const assets = await buildAssets();
    app.anims = assets.anims;
    app.nsfwPool = assets.nsfwPool;
    app.warnings = assets.warnings;
    if (assets.warnings.length) status.textContent = assets.warnings.join(' | ');
  } catch (err) {
    status.textContent = `asset load failed: ${err.message}`;
    throw err;
  }

  const menuState = new MenuState(app);
  app.state = menuState;
  app.input.attach(window);
  app.onStatus = (text) => { status.textContent = text; };
  window.__lobby = setupLobby(app, status);

  // ---- the main page: host, join, or play here (picking is on the canvas) ----
  const chrome = {
    menu: document.getElementById('menu'),
    touch: document.getElementById('touch'),
    stage: document.getElementById('stage'),
    results: document.getElementById('resultActions'),
  };
  const updatePicks = () => {
    for (const who of ['guy', 'girl']) {
      const pick = document.getElementById(`${who}Pick`);
      const chosen = app.roles.p1 === who;
      pick.setAttribute('aria-pressed', String(chosen));
      pick.querySelector('.pick-note').textContent = chosen ? 'You play' : '';
    }
  };
  for (const who of ['guy', 'girl']) {
    document.getElementById(`${who}Pick`).addEventListener('click', () => {
      if (app.state instanceof MenuState) app.state.pickCharacter(who);
      updatePicks();
    });
  }
  menuState.onRoles = updatePicks;
  document.getElementById('rematchBtn').addEventListener('click', () => {
    if (app.state instanceof MatchOverState) app.state.handleKey('Space');
  });
  document.getElementById('menuBtn').addEventListener('click', () => {
    if (app.state instanceof MatchOverState) app.state.handleKey('Enter');
  });
  document.getElementById('localBtn').addEventListener('click', () => app.startMatch());

  // tapping a character card on the menu picks that character
  canvas.addEventListener('pointerdown', (e) => {
    if (!(app.state instanceof MenuState)) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (WINDOW_W / rect.width);
    const y = (e.clientY - rect.top) * (WINDOW_H / rect.height);
    app.state.handleClick(x, y);
  });

  // ---- on-screen controls; they push into the same input pipeline ----
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const localKeys = () => (app.net && app.net.localSeat === 'p1' ? P1_KEYS : P2_KEYS);
  for (const btn of document.querySelectorAll('#touch button')) {
    const code = () => localKeys()[btn.dataset.key];
    const press = (down) => (e) => {
      e.preventDefault();
      const c = code();
      if (c) app.input.setVirtual(c, down);
    };
    btn.addEventListener('pointerdown', press(true));
    btn.addEventListener('pointerup', press(false));
    btn.addEventListener('pointercancel', press(false));
    btn.addEventListener('pointerleave', press(false));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // hide the page chrome while a match is on screen
  app.onChrome = (state) => {
    const onMenu = state instanceof MenuState;
    if (chrome.menu.hidden !== !onMenu) chrome.menu.hidden = !onMenu;
    chrome.stage.hidden = onMenu;
    chrome.results.hidden = !(state instanceof MatchOverState);
    if (onMenu) updatePicks();
    const cursor = onMenu ? 'pointer' : 'default';
    if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
    const showPad = !onMenu && (coarse || window.innerWidth < 760);
    if (chrome.touch.hidden === showPad) {
      chrome.touch.hidden = !showPad;
      fitCanvas(canvas, showPad);
    }
  };
  window.addEventListener('resize', () => fitCanvas(canvas, !chrome.touch.hidden));
  fitCanvas(canvas, !chrome.touch.hidden);

  requestAnimationFrame((t) => { app.last = t; app.frame(t); });
}

// Only auto-boot in a browser; importing this module in tests must be side-effect free.
if (typeof document !== 'undefined') boot();
