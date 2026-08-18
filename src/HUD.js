const PIP_COUNT = 10;

export class HUD {
  constructor() {
    this.pips = {
      player: document.getElementById('pips-player'),
      enemy: document.getElementById('pips-enemy'),
    };
    for (const side of ['player', 'enemy']) {
      for (let i = 0; i < PIP_COUNT; i++) {
        const pip = document.createElement('div');
        pip.className = 'pip';
        this.pips[side].appendChild(pip);
      }
    }

    this.lives = {
      player: document.querySelector('#player-card-player .lives-value'),
      enemy: document.querySelector('#player-card-enemy .lives-value'),
    };
    this.ammoCurrent = {
      player: document.getElementById('ammo-current-player'),
      enemy: document.getElementById('ammo-current-enemy'),
    };
    this.ammoMag = {
      player: document.getElementById('ammo-mag-player'),
      enemy: document.getElementById('ammo-mag-enemy'),
    };
    this.ammoReserve = {
      player: document.getElementById('ammo-reserve-player'),
      enemy: document.getElementById('ammo-reserve-enemy'),
    };
    this.weaponRow = {
      player: document.querySelector('#player-card-player .weapon-row'),
      enemy: document.querySelector('#player-card-enemy .weapon-row'),
    };

    this.timerValue = document.getElementById('timer-value');
    this.hitMarker = document.getElementById('hit-marker');
    this.startScreen = document.getElementById('start-screen');
    this.endScreen = document.getElementById('end-screen');
    this.endTitle = document.getElementById('end-title');
    this.startButton = document.getElementById('start-button');
    this.restartButton = document.getElementById('restart-button');
    this.damageFlash = document.getElementById('damage-flash');

    this._hitMarkerTimeout = null;
    this._damageFlashTimeout = null;
  }

  setPlayerCard(side, { lives, healthPct, ammo, magSize, reserve, reloading }) {
    this.lives[side].textContent = lives;

    const filled = Math.round((healthPct / 100) * PIP_COUNT);
    const pipEls = this.pips[side].children;
    for (let i = 0; i < pipEls.length; i++) {
      pipEls[i].classList.toggle('filled', i < filled);
    }

    this.ammoCurrent[side].textContent = ammo;
    this.ammoMag[side].textContent = magSize;
    this.ammoReserve[side].textContent = reserve;
    this.weaponRow[side].querySelector('.weapon-ammo').classList.toggle('reloading', !!reloading);
  }

  setTimer(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    this.timerValue.textContent = `${mm}:${ss}`;
  }

  flashHitMarker() {
    this.hitMarker.classList.remove('show');
    void this.hitMarker.offsetWidth;
    this.hitMarker.classList.add('show');
    clearTimeout(this._hitMarkerTimeout);
    this._hitMarkerTimeout = setTimeout(() => this.hitMarker.classList.remove('show'), 200);
  }

  flashDamage() {
    this.damageFlash.classList.remove('show');
    void this.damageFlash.offsetWidth;
    this.damageFlash.classList.add('show');
    clearTimeout(this._damageFlashTimeout);
    this._damageFlashTimeout = setTimeout(() => this.damageFlash.classList.remove('show'), 350);
  }

  showStart(onStart) {
    this.startScreen.classList.remove('hidden');
    this.endScreen.classList.add('hidden');
    this.startButton.onclick = onStart;
  }

  hideStart() {
    this.startScreen.classList.add('hidden');
  }

  // winner: 'player' | 'enemy' | 'draw'
  showEnd(winner, onRestart) {
    this.endScreen.classList.remove('hidden');
    if (winner === 'draw') {
      this.endTitle.textContent = 'DRAW';
      this.endTitle.className = 'draw';
    } else {
      this.endTitle.textContent = winner === 'player' ? 'YOU WIN' : 'YOU LOSE';
      this.endTitle.className = winner === 'player' ? 'win' : 'lose';
    }
    this.restartButton.onclick = onRestart;
  }

  hideEnd() {
    this.endScreen.classList.add('hidden');
  }
}
