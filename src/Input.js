export class Input {
  constructor() {
    this.keys = new Set();
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this._touchForward = 0;
    this._touchStrafe = 0;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // Called by TouchControls while the movement joystick is dragged.
  setTouchMove(forward, strafe) {
    this._touchForward = forward;
    this._touchStrafe = strafe;
  }

  // Movement axes from whichever source is active: the joystick takes
  // priority when deflected, otherwise falls back to WASD.
  getMoveAxes() {
    if (this._touchForward !== 0 || this._touchStrafe !== 0) {
      return { forward: this._touchForward, strafe: this._touchStrafe };
    }
    const forward = (this.isDown('KeyW') ? 1 : 0) - (this.isDown('KeyS') ? 1 : 0);
    const strafe = (this.isDown('KeyD') ? 1 : 0) - (this.isDown('KeyA') ? 1 : 0);
    return { forward, strafe };
  }
}
