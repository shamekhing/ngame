// Keyboard and virtual input state.
export class Input {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();   // codes pressed since the last step
    this.axis = { x: 0, y: 0 };
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
    target.addEventListener('blur', () => { this.held.clear(); this.setAxis(0, 0); });
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

  setAxis(x, y) {
    this.axis.x = Math.max(-1, Math.min(1, x));
    this.axis.y = Math.max(-1, Math.min(1, y));
  }
}

