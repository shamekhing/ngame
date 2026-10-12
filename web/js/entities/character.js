// Shared character data; methods live in focused modules.
import { geometryMethods } from './geometry.js';
import { movementMethods } from './movement.js';
import { animationMethods } from './animation.js';

export class Character {
  constructor(x, y, speed, anims, idle, idleDown, run) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.anims = anims;
    this.idle = idle;
    this.idleDown = idleDown;
    this.run = run;

    this.facing = 'right';
    this.flip = false;
    this.halfW = 13;
    this.halfH = 15;

    this.animName = idle;
    this.frameI = 0;
    this.frameT = 0;

    this.locked = false;      // true while a one-shot action anim plays
    this.stunned = false;
    this.stunTimer = 0;
    this.vx = 0;
    this.vy = 0;
    this.dodging = false;     // true during the jump-roll (passes over low cover)
    this.dodgeTimer = 0;
    this.dodgeSpeed = 0;
    this.clinging = false;    // idle against a wall -> cling animation
    this.clingAnim = null;
  }
}

for (const methods of [geometryMethods, movementMethods, animationMethods]) {
  Object.defineProperties(Character.prototype, Object.getOwnPropertyDescriptors(methods));
}
