// Fixed-timestep rendering loop.
import { FPS } from './config.js';

const STEP = 1 / FPS;

export const frameMethods = {
  frame(now) {
    if (this.shouldPause && this.shouldPause()) {
      this.last = now;
      this.acc = 0;
      this.state.draw(this.ctx);
      if (this.onChrome) this.onChrome(this.state);
      requestAnimationFrame((t) => this.frame(t));
      return;
    }
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
};
