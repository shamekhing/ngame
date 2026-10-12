// One round: arena, characters, rules, and camera state.
import { WORLD_W, WORLD_H, ROUND_SECONDS, ARENA_LAYOUTS, rects, PHASE, INTRO_MS } from '../config.js';
import { Guy, Girl } from '../entities.js';
import { buildArena } from '../arena.js';
import { State } from './base.js';
import { Camera } from './camera.js';
import { drawGame } from './game-render.js';
import { gameinputMethods } from './game-input.js';
import { gameoutcomeMethods } from './game-outcome.js';
import { gamephysicsMethods } from './game-physics.js';
import { gamenetworkMethods } from './game-network.js';
import { gameupdateMethods } from './game-update.js';

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

  draw(ctx) { drawGame(this, ctx); }
}

for (const methods of [gameinputMethods, gameoutcomeMethods, gamephysicsMethods, gamenetworkMethods, gameupdateMethods]) {
  Object.defineProperties(GameState.prototype, Object.getOwnPropertyDescriptors(methods));
}
