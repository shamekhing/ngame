// Game states + camera (menu, round, catch scene, match over).
import {
  WINDOW_W, WINDOW_H, WORLD_W, WORLD_H, FRAME, ROUND_SECONDS,
  SLAP_STUN_MS, SLAP_COOLDOWN_MS, SLAP_RADIUS, GRAB_RADIUS, ALERT_RADIUS,
  GIRL_SENSE_RADIUS,
  KNOCKBACK_PX, WIN_TARGET, P1_KEYS, P2_KEYS, ARENA_LAYOUTS, rects,
  DODGE_MS, DODGE_COOLDOWN_MS, PHASE,
  ZOOM_MIN, ZOOM_MAX, INTRO_MS, CARD_MS,
  BG, WHITE, MUTED, DANGER, GOLD, GREEN, BLUE,
} from './config.js';
import { Guy, Girl, overlaps } from './entities.js';
import { buildArena } from './arena.js';
import { EV, CTL, WIN_SCENES } from './net/netcode.js';

export function drawText(ctx, app, text, x, y, size = 18, color = WHITE, center = false, bold = false) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px monospace`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const w = ctx.measureText(text).width;
  const left = center ? x - w / 2 : x;
  const baseline = center ? y + size * 0.35 : y + size * 0.8;
  ctx.fillText(text, Math.round(left), Math.round(baseline));
  return w;
}

export class Camera {
  constructor(opts = {}) {
    this.center = [WORLD_W / 2, WORLD_H / 2];
    this.introT = opts.introT || 0;            // seconds left of the round intro
    this.introTotal = this.introT;
    this.zoom = this.introT > 0 ? ZOOM_MIN : 1;  // open on the whole map, then push in
  }

  update(points, dt) {
    const midX = points.reduce((s, p) => s + p[0], 0) / points.length;
    const midY = points.reduce((s, p) => s + p[1], 0) / points.length;
    const dx = Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]));
    const dy = Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1]));
    const pad = 220;
    let desired = Math.min(WINDOW_W / (dx + pad), WINDOW_H / (dy + pad));
    desired = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, desired));

    if (this.introT > 0) {                      // whole map -> the players
      this.introT = Math.max(0, this.introT - dt);
      const k = 1 - (this.introTotal ? this.introT / this.introTotal : 0);
      const e = 1 - (1 - k) * (1 - k);          // ease-out
      this.zoom = ZOOM_MIN + (desired - ZOOM_MIN) * e;
      this.center[0] = WORLD_W / 2 + (midX - WORLD_W / 2) * e;
      this.center[1] = WORLD_H / 2 + (midY - WORLD_H / 2) * e;
      return;
    }

    this.zoom += (desired - this.zoom) * Math.min(1, dt * 5);
    const halfW = WINDOW_W / (2 * this.zoom);
    const halfH = WINDOW_H / (2 * this.zoom);
    this.center[0] = Math.min(Math.max(midX, halfW), WORLD_W - halfW);
    this.center[1] = Math.min(Math.max(midY, halfH), WORLD_H - halfH);
  }

  toScreen(x, y) {
    return [(x - this.center[0]) * this.zoom + WINDOW_W / 2,
            (y - this.center[1]) * this.zoom + WINDOW_H / 2];
  }
}

export class State {
  constructor(app) { this.app = app; this.phase = PHASE.MENU; }
  handleKey() {}
  update() {}
  draw() {}

  /** the host announces a transition; the guest re-plays it from the event */
  netEvent(sub, values = []) {
    const net = this.app.net;
    if (net && net.isHost) net.event(sub, values);
  }
}

/** transitions the host announces that any guest state has to re-play */
function handleSharedNetEvent(app, sub, values = []) {
  switch (sub) {
    case EV.NSFW:
      if (!(app.state instanceof NsfwState)) app.state = new NsfwState(app, values[0]);
      return true;
    case EV.ROUND:
      app.match.round = values[0] || 1;
      if (values.length > 2) { app.match.guy = values[1]; app.match.girl = values[2]; }
      app.state = values[3] ? new IntroState(app) : new GameState(app);
      return true;
    case EV.MATCH_OVER:
      app.state = new MatchOverState(app, values[0] ? 'girl' : 'guy');
      return true;
    case EV.MENU:
      app.state = new MenuState(app);
      return true;
    case EV.REMATCH:
      app.startMatch();
      return true;
    case CTL.BYE:
      app.onPeerLeft();
      return true;
    default:
      return false;
  }
}

/**
 * In netplay only the host drives the flow: on the guest a key press on a
 * "press any key" screen is forwarded, and the host's own press comes back as
 * a transition. @returns {boolean} true when the press was forwarded.
 */
function forwardKey(app) {
  const net = app.net;
  if (!net || net.isHost) return false;
  net.queueAction('continue');
  return true;
}

export class MenuState extends State {
  constructor(app) {
    super(app);
    this.phase = PHASE.MENU;
    this.previewGuy = { anim: app.anims['guy-walk'], t: 0, i: 0 };
    this.previewGirl = { anim: app.anims['girl-run'], t: 0, i: 0 };
    this.pulse = 0;
  }

  step(p, dt) { stepAnim(p, dt); }

  applyNetEvent(sub, values = []) { handleSharedNetEvent(this.app, sub, values); }

  handleKey(code) {
    if (code === 'KeyR') {
      this.pickCharacter(this.app.roles.p1 === 'guy' ? 'girl' : 'guy');
    } else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
      if (this.app.net && !this.app.net.isHost) return;   // the host starts the match
      this.app.startMatch();
      if (this.app.net) this.app.net.event(EV.ROUND, [1, 0, 0, 1]);
    }
  }

  /** the host (or a local player) picks the character they play */
  pickCharacter(who) {
    if (this.app.net && !this.app.net.isHost) return;      // only the host picks
    this.app.roles = { p1: who, p2: who === 'guy' ? 'girl' : 'guy' };
    if (this.onRoles) this.onRoles(this.app.roles);
  }

  /** the two character cards drawn on the menu; they double as the picker */
  picks() {
    const cx = WINDOW_W / 2;
    return [
      { who: 'guy', p: this.previewGuy, x: cx - 150, flip: false },
      { who: 'girl', p: this.previewGirl, x: cx + 150, flip: true },
    ];
  }

  /** canvas click/tap: pick the character whose card was hit */
  handleClick(x, y) {
    for (const pick of this.picks()) {
      if (x >= pick.x - 92 && x <= pick.x + 92 && y >= 196 && y <= 410) {
        this.pickCharacter(pick.who);
        return;
      }
    }
  }

  update(dt) {
    this.step(this.previewGuy, dt);
    this.step(this.previewGirl, dt);
    this.pulse = (this.pulse + dt) % 1;
  }

  /** title + the two characters; hosting/joining buttons live in the page */
  draw(ctx) {
    const app = this.app;
    ctx.fillStyle = '#120c1e';
    ctx.fillRect(0, 0, WINDOW_W, WINDOW_H);
    const cx = WINDOW_W / 2;

    drawText(ctx, app, 'CATCH THE GIRL', cx, 96, 60, WHITE, true, true);
    drawText(ctx, app, 'a top-down chase for two', cx, 140, 17, MUTED, true);

    const picks = this.picks();
    for (const pick of picks) {
      const chosen = app.roles.p1 === pick.who;
      ctx.fillStyle = chosen ? '#241a3d' : '#171227';
      this.roundRect(ctx, pick.x - 92, 196, 184, 214, 14);
      ctx.fill();
      ctx.strokeStyle = chosen ? GOLD : '#2a2140';
      ctx.lineWidth = chosen ? 3 : 2;
      this.roundRect(ctx, pick.x - 92, 196, 184, 214, 14);
      ctx.stroke();

      ctx.save();
      if (chosen) {
        const w = 0.5 + 0.5 * Math.sin(this.pulse * Math.PI * 2);
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 18 + 12 * w;
      } else {
        ctx.globalAlpha = 0.45;
      }
      this.sprite(ctx, pick.p, pick.x, 303, pick.flip, 3);
      ctx.restore();

      drawText(ctx, app, pick.who.toUpperCase(), pick.x, 396, 17,
        chosen ? GOLD : MUTED, true, chosen);
      if (chosen) drawText(ctx, app, 'YOU PLAY', pick.x, 182, 13, GOLD, true, true);
    }

    drawText(ctx, app, 'tap a character to pick yours', cx, 466, 15, MUTED, true);
    drawText(ctx, app, 'press ENTER to play here - or host / join below', cx, 494, 15, GREEN, true);
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  sprite(ctx, p, x, y, flip, scale = 1) {
    const f = p.anim.frames[p.i];
    const s = 48 * scale;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(f.image, f.sx, f.sy, f.sw, f.sh, -s / 2, -s / 2, s, s);
    ctx.restore();
  }
}

const KEY_LABELS = {
  KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyF: 'F',
  ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT',
};

/** the controls of one seat, as shown on its own device before a match */
function controlLines(seat, roles) {
  const keys = seat === 'p1' ? P1_KEYS : P2_KEYS;
  const who = roles[seat];
  const slot = seat === 'p1' ? 'PLAYER 1' : 'PLAYER 2';
  return [
    slot,
    ['MOVE', [keys.up, keys.left, keys.down, keys.right]
      .map((k) => KEY_LABELS[k] || k).join(' ')],
    ['ACTION', `${KEY_LABELS[keys.action]} (${who === 'guy' ? 'grab' : 'slap'})`],
    ['DODGE', KEY_LABELS[keys.dodge]],
  ];
}

/**
 * Shown on each device right before a match: that player's controls and a
 * 3-2-1 countdown. When it ends the round starts with the camera pulled back
 * over the whole map, then pushing in on the players.
 */
export class IntroState extends State {
  constructor(app) {
    super(app);
    this.phase = PHASE.MENU;
    this.t = CARD_MS / 1000;
    this.cardGuy = { anim: app.anims['guy-idle'], t: 0, i: 0 };
    this.cardGirl = { anim: app.anims['girl-idle'], t: 0, i: 0 };
  }

  applyNetEvent(sub, values = []) { handleSharedNetEvent(this.app, sub, values); }

  handleKey(code) {
    if (this.app.net && !this.app.net.isHost) return;    // the host drives
    if (code === 'Escape') {
      if (this.app.net) this.app.leaveNet();
      this.app.state = new MenuState(this.app);
    } else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
      this.begin();                                       // skip the card
    }
  }

  update(dt) {
    stepAnim(this.cardGuy, dt);
    stepAnim(this.cardGirl, dt);
    this.t -= dt;
    if (this.t <= 0) this.begin();
  }

  begin() {
    if (this.app.state !== this) return;
    this.app.beginRound({ intro: true });
  }

  /** which seats this device plays */
  seats() {
    const net = this.app.net;
    return net ? [net.localSeat] : ['p1', 'p2'];
  }

  draw(ctx) {
    const app = this.app;
    ctx.fillStyle = '#120c1e';
    ctx.fillRect(0, 0, WINDOW_W, WINDOW_H);
    const cx = WINDOW_W / 2;

    drawText(ctx, app, `ROUND ${app.match.round}`, cx, 62, 30, DANGER, true, true);

    const seats = this.seats();
    const cols = seats.length === 1 ? [cx] : [cx - 200, cx + 200];
    seats.forEach((seat, i) => {
      const x = cols[i];
      const lines = controlLines(seat, app.roles);
      const picked = app.roles[seat];
      const card = picked === 'guy' ? this.cardGuy : this.cardGirl;
      this.sprite(ctx, card, x, 152, picked === 'girl', 2);

      drawText(ctx, app, `YOU PLAY ${picked.toUpperCase()}`, x, 216, 16, GOLD, true, true);
      lines.slice(1).forEach((row, r) => {
        drawText(ctx, app, row[0], x - 136, 260 + r * 30, 14, MUTED, false, true);
        drawText(ctx, app, row[1], x - 4, 260 + r * 30, 16, WHITE, false, true);
      });
    });

    const go = this.t <= 0.55;
    const num = Math.max(1, Math.ceil(this.t));
    drawText(ctx, app, go ? 'GO!' : String(num), cx, 448, 76, go ? GREEN : WHITE, true, true);
    drawText(ctx, app, 'enter skips', cx, 510, 13, MUTED, true);
  }

  sprite(ctx, p, x, y, flip, scale = 1) {
    const f = p.anim.frames[p.i];
    const s = 48 * scale;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(f.image, f.sx, f.sy, f.sw, f.sh, -s / 2, -s / 2, s, s);
    ctx.restore();
  }
}

export class GameState extends State {
  constructor(app, opts = {}) {
    super(app);
    this.phase = PHASE.GAME;
    const layout = ARENA_LAYOUTS[(app.match.round - 1) % ARENA_LAYOUTS.length];
    this.layoutName = layout.name;
    this.walls = rects(layout.solid);
    this.lowWalls = rects(layout.low);
    // a match opens on the whole map, then pushes in on the players
    this.camera = new Camera({ introT: opts.intro ? INTRO_MS / 1000 : 0 });
    this.arena = buildArena(this.layoutName, this.walls, this.lowWalls, app.makeCanvas);
    this.guy = new Guy(180, WORLD_H / 2, app.anims);
    this.girl = new Girl(WORLD_W - 180, WORLD_H / 2, app.anims);
    this.girl.facing = 'left';
    this.girl.flip = true;

    this.p1Char = app.roles.p1 === 'guy' ? this.guy : this.girl;
    this.p2Char = app.roles.p1 === 'guy' ? this.girl : this.guy;

    this.timeLeft = ROUND_SECONDS;
    this.elapsed = 0;
    this.startLock = 1.3;
    this.roundOver = false;
    this.banner = { title: `ROUND ${app.match.round}`, sub: 'GET READY...', t: 1.3, cb: null };
    this.popups = [];
    this.shakeT = 0;
    this.slapHitT = -1;
    this.transitionT = -1;
    this.transitionCb = null;
    this.clingTime = 0;
    this.girl.play('girl-enter', true);   // round-intro (Enter sheet)
  }

  handleKey(code) {
    if (code === 'Escape') {
      if (this.app.net) this.app.leaveNet();
      this.app.state = new MenuState(this.app);
      return;
    }
    if (this.roundOver || this.startLock > 0) return;

    const net = this.app.net;
    if (net && !net.isHost) {
      // the host resolves every hit; we only predict the animation locally
      const mine = this.mappingFor(net.localSeat);
      const char = net.localChar(this);
      if (code === mine.action) { net.queueAction('action'); this.previewAction(char); }
      else if (code === mine.dodge) { net.queueAction('dodge'); this.previewDodge(char); }
      return;
    }

    if (code === P1_KEYS.action) this.doAction(this.p1Char);
    else if (code === P2_KEYS.action) this.doAction(this.p2Char);
    else if (code === P1_KEYS.dodge) this.doDodge(this.p1Char);
    else if (code === P2_KEYS.dodge) this.doDodge(this.p2Char);
  }

  /** guest-side prediction: play the animation now, the host owns the outcome */
  previewAction(char) {
    if (char === this.girl) this.girl.trySlap(this.elapsed, SLAP_COOLDOWN_MS);
  }

  previewDodge(char) { this.doDodge(char); }

  doAction(char) {
    if (char === this.guy) {
      if (this.girl.dodging) {
        this.addPopup(this.girl.x, this.girl.y - 34, 'MISS!', GOLD);   // dodge i-frames
      } else if (this.dist(this.guy, this.girl) <= GRAB_RADIUS) {
        this.onCatch();
      } else {
        this.addPopup(this.guy.x, this.guy.y - 34, 'grab!', BLUE);
      }
    } else if (this.girl.trySlap(this.elapsed, SLAP_COOLDOWN_MS)) {
      this.slapHitT = 0.14;
    }
  }

  doDodge(char) {
    if (char === this.girl) this.girl.tryDodge(this.elapsed, DODGE_COOLDOWN_MS, DODGE_MS);
  }

  onCatch() {
    if (this.roundOver) return;
    this.roundOver = true;
    this.app.match.guy += 1;
    this.shakeT = 0.28;
    this.addPopup(this.girl.x, this.girl.y - 40, 'CAUGHT!', DANGER);
    this.girl.play('girl-death', true);           // uses the Death sheet
    this.transitionT = 0.9;
    this.transitionCb = () => this.goNsfw(WIN_SCENES.guy);   // guy wins -> Sex 1
    this.netEvent(EV.CATCH);
  }

  onEscape() {
    if (this.roundOver) return;
    this.roundOver = true;
    this.app.match.girl += 1;
    this.addPopup(this.girl.x, this.girl.y - 40, 'ESCAPED!', GREEN);
    this.banner = {
      title: 'GIRL ESCAPES!', sub: 'the guy ran out of time', t: 1.3,
      cb: () => this.goNsfw(WIN_SCENES.girl),    // girl wins -> Sex 2
    };
    this.netEvent(EV.ESCAPE);
  }

  finishRound() {
    if (this.app.match.girl >= WIN_TARGET) {
      this.netEvent(EV.MATCH_OVER, [1]);
      this.app.state = new MatchOverState(this.app, 'girl');
    } else {
      this.app.match.round += 1;
      this.netEvent(EV.ROUND, [this.app.match.round, this.app.match.guy, this.app.match.girl]);
      this.app.state = new GameState(this.app);
    }
  }

  goNsfw(scene = WIN_SCENES.guy) {
    this.netEvent(EV.NSFW, [scene]);
    this.app.state = new NsfwState(this.app, scene);
  }

  resolveSlap() {
    if (this.dist(this.girl, this.guy) <= SLAP_RADIUS) {
      this.guy.stun(SLAP_STUN_MS);
      this.knockback(this.guy, this.girl.x, this.girl.y);
      this.shakeT = 0.12;
      this.addPopup(this.guy.x, this.guy.y - 34, 'SLAP!', DANGER);
      this.addPopup(this.guy.x, this.guy.y - 56, 'STUNNED', GOLD);
    }
  }

  knockback(target, fromX, fromY) {
    const ang = Math.atan2(target.y - fromY, target.x - fromX);
    target.setPos(target.x + Math.cos(ang) * KNOCKBACK_PX,
                  target.y + Math.sin(ang) * KNOCKBACK_PX);
  }

  dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  nearWall(ent) {
    const r = ent.rect();
    const inflated = { x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 };
    return this.walls.some((w) => overlaps(inflated, w));
  }

  addPopup(x, y, text, color) {
    this.popups.push({ x, y, y0: y, text, color, t: 0.75 });
  }

  updatePopups(dt) {
    for (const p of this.popups) p.t -= dt;
    this.popups = this.popups.filter((p) => p.t > 0);
  }

  mappingFor(seat) { return seat === 'p1' ? P1_KEYS : P2_KEYS; }

  /** whose keyboard drives this seat (netplay: the peer's keys arrive as bits) */
  heldFor(who) {
    const net = this.app.net;
    if (!net || !who) return this.app.input.held;
    return who === net.localSeat ? this.app.input.held : net.remoteKeys;
  }

  keysFor(mapping, who = null) {
    const held = this.heldFor(who);
    return {
      up: held.has(mapping.up), down: held.has(mapping.down),
      left: held.has(mapping.left), right: held.has(mapping.right),
    };
  }

  /** in netplay the guest only simulates the character it owns */
  drives(ent) {
    const net = this.app.net;
    if (!net || net.isHost) return true;      // single player, or host = authority
    return ent === net.localChar(this);
  }

  /** guest: re-play a transition the host announced */
  applyNetEvent(sub, values = []) {
    if (handleSharedNetEvent(this.app, sub, values)) return;
    switch (sub) {
      case EV.CATCH:
        if (!this.roundOver) {
          this.roundOver = true;
          this.shakeT = 0.28;
          this.addPopup(this.girl.x, this.girl.y - 40, 'CAUGHT!', DANGER);
          this.girl.play('girl-death', true);
          this.transitionT = 0.9;
          this.transitionCb = () => this.goNsfw(WIN_SCENES.guy);
        }
        break;
      case EV.ESCAPE:
        if (!this.roundOver) {
          this.roundOver = true;
          this.addPopup(this.girl.x, this.girl.y - 40, 'ESCAPED!', GREEN);
          this.banner = {
            title: 'GIRL ESCAPES!', sub: 'the guy ran out of time', t: 1.3,
            cb: () => this.goNsfw(WIN_SCENES.girl),
          };
        }
        break;
      default: break;
    }
  }

  update(dt) {
    this.elapsed += dt;

    if (this.transitionT > 0) {
      this.transitionT -= dt;
      if (this.transitionT <= 0 && this.transitionCb) {
        const cb = this.transitionCb;
        this.transitionCb = null;
        cb();
        return;
      }
    }

    if (this.shakeT > 0) this.shakeT -= dt;

    if (this.banner !== null && this.banner.t > 0) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) {
        const cb = this.banner.cb;
        this.banner = null;
        if (cb) { cb(); return; }
      }
    }

    if (this.startLock > 0) this.startLock -= dt;

    if (!this.roundOver) this.updatePlay(dt);
    else { this.guy.vx = 0; this.guy.vy = 0; this.girl.vx = 0; this.girl.vy = 0; }

    this.guy.update(dt);
    this.girl.update(dt);
    this.updatePopups(dt);
    this.camera.update([[this.guy.x, this.guy.y], [this.girl.x, this.girl.y]], dt);
  }

  updatePlay(dt) {
    const p1 = this.keysFor(P1_KEYS, 'p1');
    const p2 = this.keysFor(P2_KEYS, 'p2');
    const [guyKeys, girlKeys] = this.app.roles.p1 === 'guy' ? [p1, p2] : [p2, p1];

    const playable = this.startLock <= 0;
    const step = (ent, keys) => {
      if (!playable || !this.drives(ent)) {
        if (this.drives(ent)) { ent.vx = 0; ent.vy = 0; }
        return;                                  // not ours: the host places it
      }
      ent.move(keys, dt, this.walls, this.lowWalls);
    };
    step(this.guy, guyKeys);
    step(this.girl, girlKeys);

    if (this.slapHitT >= 0) {
      this.slapHitT -= dt;
      if (this.slapHitT < 0) this.resolveSlap();
    }

    this.guy.alert = this.dist(this.guy, this.girl) <= ALERT_RADIUS;
    this.guy.sync();
    this.girl.sense = this.dist(this.guy, this.girl) <= GIRL_SENSE_RADIUS;

    // girl: cling to a wall when idle beside one, else normal animation
    this.girl.clinging = this.nearWall(this.girl);
    if (this.girl.clinging) {
      this.clingTime += dt;
      this.girl.clingAnim = this.clingTime > 0.7 ? 'girl-wallhang' : 'girl-wallcling';
    } else {
      this.clingTime = 0;
    }
    if (this.startLock <= 0) this.girl.sync();

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.onEscape();
    }
  }

  draw(ctx) {
    const ox = this.shakeT > 0 ? Math.round(Math.random() * 8 - 4) : 0;
    const oy = this.shakeT > 0 ? Math.round(Math.random() * 8 - 4) : 0;
    const cam = this.camera;

    this.drawArena(ctx, ox, oy);

    const ents = [this.guy, this.girl].sort((a, b) => a.y - b.y);
    for (const ent of ents) {
      const { frame, flip } = ent.currentFrame();
      const size = Math.round(FRAME * cam.zoom);
      const half = Math.round(size / 2);
      const [sx, sy] = cam.toScreen(ent.x, ent.y);
      ctx.save();
      ctx.translate(Math.round(sx + ox), Math.round(sy + oy));
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(frame.image, frame.sx, frame.sy, frame.sw, frame.sh,
                    -half, -half, size, size);
      ctx.restore();
    }
    this.drawSense(ctx, ox, oy);

    for (const p of this.popups) {
      const prog = 1 - p.t / 0.75;
      const [sx, sy] = cam.toScreen(p.x, p.y0 - prog * 34);
      ctx.globalAlpha = Math.max(0, p.t / 0.75);
      drawText(ctx, this.app, p.text, sx + ox, sy + oy, 18, p.color, true, true);
      ctx.globalAlpha = 1;
    }

    ctx.drawImage(this.arena.vignette, 0, 0);   // moody edges, HUD stays readable
    this.drawHud(ctx);
  }

  // The painted world slice is blitted through the camera transform.
  drawArena(ctx, ox, oy) {
    const cam = this.camera;
    const vw = WINDOW_W / cam.zoom;
    const vh = WINDOW_H / cam.zoom;
    const left = Math.min(Math.max(cam.center[0] - vw / 2, 0), WORLD_W - vw);
    const top = Math.min(Math.max(cam.center[1] - vh / 2, 0), WORLD_H - vh);
    const sx = Math.trunc(left);
    const sy = Math.trunc(top);
    const sw = Math.min(Math.max(1, Math.round(vw)), WORLD_W - sx);
    const sh = Math.min(Math.max(1, Math.round(vh)), WORLD_H - sy);
    ctx.drawImage(this.arena.surface, sx, sy, sw, sh,
      Math.round(ox - (sx - left) * cam.zoom), Math.round(oy - (sy - top) * cam.zoom),
      WINDOW_W, WINDOW_H);
  }

  /** the girl's "someone is close" sense: a pulsing bang above her head */
  drawSense(ctx, ox, oy) {
    const girl = this.girl;
    if (!girl.sense || girl.locked) return;
    const cam = this.camera;
    const [sx, sy] = cam.toScreen(girl.x, girl.y);
    const r = Math.max(5, Math.round(7 * cam.zoom));
    const y = sy + oy - Math.round(34 * cam.zoom);
    const pulse = 0.55 + 0.45 * Math.sin(this.elapsed * 9);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = DANGER;
    ctx.beginPath();
    ctx.arc(Math.round(sx + ox), y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawText(ctx, this.app, '!', sx + ox, y + r * 0.42, Math.round(r * 1.7), '#1a1426', true, true);
  }

  drawHud(ctx) {
    const app = this.app;
    const m = app.match;
    drawText(ctx, app, `GUY ${m.guy}   |   GIRL ${m.girl}`, 16, 12, 18, WHITE, false, true);
    drawText(ctx, app, `ROUND ${m.round}  (${this.layoutName})   -   first to ${WIN_TARGET}`,
      16, 38, 14, MUTED);
    drawText(ctx, app, `TIME ${Math.ceil(this.timeLeft)}`, WINDOW_W / 2, 22, 30, GOLD, true, true);

    const bx = WINDOW_W - 16 - 160;
    drawText(ctx, app, 'SLAP', bx, WINDOW_H - 60, 12, '#ff9ec4', false, true);
    ctx.fillStyle = '#332244';
    ctx.fillRect(bx, WINDOW_H - 46, 160, 10);
    ctx.fillStyle = DANGER;
    ctx.fillRect(bx, WINDOW_H - 46,
      160 * (1 - this.girl.cooldownFraction(this.elapsed, SLAP_COOLDOWN_MS)), 10);
    drawText(ctx, app, 'DODGE', bx, WINDOW_H - 30, 12, BLUE, false, true);
    ctx.fillStyle = '#222c44';
    ctx.fillRect(bx, WINDOW_H - 16, 160, 10);
    ctx.fillStyle = BLUE;
    ctx.fillRect(bx, WINDOW_H - 16,
      160 * (1 - this.girl.dodgeFraction(this.elapsed, DODGE_COOLDOWN_MS)), 10);

    const hint = app.roles.p1 === 'guy'
      ? 'P1 WASD+F = GUY (F to grab)   |   P2 Arrows+Space = GIRL (Space slap, RSHIFT dodge)'
      : 'P1 WASD+F = GIRL (F slap, LSHIFT dodge)   |   P2 Arrows+Space = GUY (Space to grab)';
    drawText(ctx, app, hint, 16, WINDOW_H - 26, 13, MUTED);

    if (this.banner) {
      const cx = WINDOW_W / 2;
      const cy = WINDOW_H / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.63)';
      ctx.fillRect(cx - 270, cy - 60, 540, 120);
      drawText(ctx, app, this.banner.title, cx, cy - 18, 40, WHITE, true, true);
      drawText(ctx, app, this.banner.sub, cx, cy + 28, 18, GOLD, true);
    }
  }
}

/** advance any {anim, t, i} preview player */
function stepAnim(p, dt) {
  const spf = 1 / p.anim.fps;
  p.t += dt;
  while (p.t >= spf) { p.t -= spf; p.i = (p.i + 1) % p.anim.frames.length; }
}

function uth(a, b) { return a + Math.random() * (b - a); }

export class NsfwState extends State {
  /**
   * The round-outcome scene. `scene` is an index into the nsfw pool:
   * guy win -> Sex 1, girl win -> Sex 2; null shuffles two out of the pool.
   */
  constructor(app, scene = null) {
    super(app);
    this.phase = PHASE.NSFW;
    const pool = app.nsfwPool.filter((entry) => app.anims[entry.anim]);   // skip --sfw gaps
    if (scene !== null && scene >= 0 && scene < pool.length) {
      this.sequence = [pool[scene]];
    } else {
      for (let i = pool.length - 1; i > 0; i -= 1) {   // shuffle
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      this.sequence = pool.length >= 2 ? pool.slice(0, 2) : pool;
    }
    this.title = scene === WIN_SCENES.girl ? 'ESCAPED!' : 'CAUGHT!';
    this.index = 0;
    this.frameI = 0;
    this.frameT = 0;
    this.timer = 0.5;        // input grace period
    this.autoT = 5;
    this.done = false;
    this.hearts = Array.from({ length: 12 }, () => [
      uth(60, WINDOW_W - 60), uth(WINDOW_H * 0.5, WINDOW_H - 40),
      uth(12, 26), Math.random(),
    ]);
  }

  get cur() { return this.sequence[this.index]; }

  anim() { return this.cur ? this.app.anims[this.cur.anim] : null; }

  handleKey() {
    if (this.timer > 0 || this.done) return;
    if (forwardKey(this.app)) return;              // the host moves the flow on
    this.advance();
  }

  applyNetEvent(sub, values = []) { handleSharedNetEvent(this.app, sub, values); }

  advance() {
    if (this.done) return;
    this.index += 1;
    if (this.index < this.sequence.length) {
      this.frameI = 0;
      this.frameT = 0;
      this.autoT = 5;
      return;
    }
    this.done = true;
    this.finish();
  }

  finish() {
    const m = this.app.match;
    if (m.guy >= WIN_TARGET) {
      this.netEvent(EV.MATCH_OVER, [0]);
      this.app.state = new MatchOverState(this.app, 'guy');
    } else if (m.girl >= WIN_TARGET) {
      this.netEvent(EV.MATCH_OVER, [1]);
      this.app.state = new MatchOverState(this.app, 'girl');
    } else {
      m.round += 1;
      this.netEvent(EV.ROUND, [m.round, m.guy, m.girl]);
      this.app.state = new GameState(this.app);
    }
  }

  update(dt) {
    if (this.timer > 0) this.timer -= dt;
    const anim = this.anim();
    if (anim) {
      const spf = 1 / anim.fps;
      this.frameT += dt;
      while (this.frameT >= spf) {
        this.frameT -= spf;
        this.frameI = (this.frameI + 1) % anim.frames.length;
      }
    }
    if (!this.done) {
      this.autoT -= dt;
      if (this.autoT <= 0) this.advance();
    }
    for (const h of this.hearts) {
      h[3] += dt * 0.15;
      if (h[3] > 1) h[3] = 0;
    }
  }

  draw(ctx) {
    const app = this.app;
    ctx.fillStyle = '#160a14';
    ctx.fillRect(0, 0, WINDOW_W, WINDOW_H);

    const anim = this.anim();
    if (anim) {
      const f = anim.frames[this.frameI % anim.frames.length];
      const size = FRAME * 5;
      ctx.drawImage(f.image, f.sx, f.sy, f.sw, f.sh,
        Math.round(WINDOW_W / 2 - size / 2),
        Math.round(WINDOW_H / 2 + 6 - size / 2), size, size);
    }

    ctx.fillStyle = DANGER;
    for (const [hx, hy, r, t] of this.hearts) {
      ctx.beginPath();
      ctx.arc(Math.round(hx), Math.round(hy - t * 180), Math.round(r * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }

    drawText(ctx, app, this.title, WINDOW_W / 2, 46, 44, DANGER, true, true);
    const m = app.match;
    drawText(ctx, app, `GUY ${m.guy}  |  GIRL ${m.girl}`, WINDOW_W / 2, WINDOW_H - 70, 20, WHITE, true, true);
    if (this.cur && this.cur.label) {
      drawText(ctx, app, this.cur.label, WINDOW_W / 2, WINDOW_H - 112, 18, GOLD, true);
    }

    const blink = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 600));
    const c = [154, 143, 181].map((v) => Math.round(v * blink));
    drawText(ctx, app, 'press any key to continue', WINDOW_W / 2, WINDOW_H - 36, 15,
      `rgb(${c[0]},${c[1]},${c[2]})`, true);
  }
}

export class MatchOverState extends State {
  constructor(app, winner) {
    super(app);
    this.phase = PHASE.MATCHOVER;
    this.winner = winner;
    this.preview = {
      anim: app.anims[winner === 'guy' ? 'guy-walk' : 'girl-run'], t: 0, i: 0,
    };
  }

  handleKey(code) {
    if (forwardKey(this.app)) return;              // the host picks for both of us
    if (code === 'Enter' || code === 'NumpadEnter') {
      this.app.state = new MenuState(this.app);
      if (this.app.net) this.app.net.event(EV.MENU);
    } else if (code === 'Space') {
      this.app.startMatch();
      if (this.app.net) this.app.net.event(EV.ROUND, [1, 0, 0, 1]);
    }
  }

  applyNetEvent(sub, values = []) { handleSharedNetEvent(this.app, sub, values); }

  update(dt) { stepAnim(this.preview, dt); }

  draw(ctx) {
    const app = this.app;
    ctx.fillStyle = '#100a18';
    ctx.fillRect(0, 0, WINDOW_W, WINDOW_H);
    const guyWon = this.winner === 'guy';
    drawText(ctx, app, guyWon ? 'GUY WINS!' : 'GIRL WINS!', WINDOW_W / 2, 120, 56,
      guyWon ? BLUE : DANGER, true, true);
    drawText(ctx, app, guyWon ? 'he caught her enough times' : 'she slipped away every time',
      WINDOW_W / 2, 176, 18, MUTED, true);
    const m = app.match;
    drawText(ctx, app, `FINAL SCORE   GUY ${m.guy}  -  ${m.girl} GIRL`,
      WINDOW_W / 2, 240, 22, WHITE, true, true);

    const f = this.preview.anim.frames[this.preview.i];
    const size = FRAME * 4;
    ctx.save();
    ctx.translate(Math.round(WINDOW_W / 2), 340);
    if (!guyWon) ctx.scale(-1, 1);
    ctx.drawImage(f.image, f.sx, f.sy, f.sw, f.sh, -size / 2, -size / 2, size, size);
    ctx.restore();

    drawText(ctx, app, '[ ENTER ] back to menu      [ SPACE ] rematch',
      WINDOW_W / 2, WINDOW_H - 50, 16, GREEN, true, true);
  }
}
