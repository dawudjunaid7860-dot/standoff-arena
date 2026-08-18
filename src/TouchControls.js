const JOYSTICK_MAX_RADIUS = 45;

export class TouchControls {
  static isSupported() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  constructor(input, { onFireStart, onFireEnd, onReload }) {
    this.input = input;
    this.onFireStart = onFireStart;
    this.onFireEnd = onFireEnd;
    this.onReload = onReload;

    this.active = TouchControls.isSupported();
    this.firing = false;

    this.root = document.getElementById('touch-controls');
    this.joystickBase = document.getElementById('joystick-base');
    this.joystickNub = document.getElementById('joystick-nub');
    this.fireButton = document.getElementById('fire-button');
    this.reloadButton = document.getElementById('reload-button');

    this._joystickTouchId = null;
    this._fireTouchId = null;
    this._joystickCenter = { x: 0, y: 0 };

    if (this.active) {
      this.root.classList.remove('hidden');
      this._bindJoystick();
      this._bindFireButton();
      this._bindReloadButton();
    }
  }

  _bindJoystick() {
    const base = this.joystickBase;

    const start = (e) => {
      e.preventDefault();
      if (this._joystickTouchId !== null) return;
      const touch = e.changedTouches[0];
      this._joystickTouchId = touch.identifier;
      const rect = base.getBoundingClientRect();
      this._joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this._updateJoystick(touch.clientX, touch.clientY);
    };

    const move = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === this._joystickTouchId) {
          e.preventDefault();
          this._updateJoystick(touch.clientX, touch.clientY);
        }
      }
    };

    const end = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === this._joystickTouchId) {
          this._joystickTouchId = null;
          this.joystickNub.style.transform = 'translate(-50%, -50%)';
          this.input.setTouchMove(0, 0);
        }
      }
    };

    base.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end, { passive: false });
    window.addEventListener('touchcancel', end, { passive: false });
  }

  _updateJoystick(clientX, clientY) {
    let dx = clientX - this._joystickCenter.x;
    let dy = clientY - this._joystickCenter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > JOYSTICK_MAX_RADIUS) {
      dx = (dx / dist) * JOYSTICK_MAX_RADIUS;
      dy = (dy / dist) * JOYSTICK_MAX_RADIUS;
    }
    this.joystickNub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    // Screen-down drag should move the character toward the camera (+Z,
    // same as the S key), so forward is the negated vertical axis.
    const strafe = dx / JOYSTICK_MAX_RADIUS;
    const forward = -dy / JOYSTICK_MAX_RADIUS;
    this.input.setTouchMove(forward, strafe);
  }

  _bindFireButton() {
    const start = (e) => {
      e.preventDefault();
      if (this._fireTouchId !== null) return;
      this._fireTouchId = e.changedTouches[0].identifier;
      this.firing = true;
      this.fireButton.classList.add('pressed');
      this.onFireStart?.();
    };
    const end = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === this._fireTouchId) {
          this._fireTouchId = null;
          this.firing = false;
          this.fireButton.classList.remove('pressed');
          this.onFireEnd?.();
        }
      }
    };
    this.fireButton.addEventListener('touchstart', start, { passive: false });
    this.fireButton.addEventListener('touchend', end, { passive: false });
    this.fireButton.addEventListener('touchcancel', end, { passive: false });
  }

  _bindReloadButton() {
    this.reloadButton.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this.onReload?.();
      },
      { passive: false }
    );
  }
}
