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
    this.weaponIcon = {
      player: document.getElementById('weapon-icon-player'),
      enemy: document.getElementById('weapon-icon-enemy'),
    };
    this.weaponName = {
      player: document.getElementById('weapon-name-player'),
      enemy: document.getElementById('weapon-name-enemy'),
    };
    this.downTag = {
      player: document.getElementById('down-tag-player'),
      enemy: document.getElementById('down-tag-enemy'),
    };

    this.timerValue = document.getElementById('timer-value');
    this.hitMarker = document.getElementById('hit-marker');
    this.damageIndicator = document.getElementById('damage-indicator');
    this.startScreen = document.getElementById('start-screen');
    this.endScreen = document.getElementById('end-screen');
    this.endTitle = document.getElementById('end-title');
    this.startButton = document.getElementById('start-button');
    this.restartButton = document.getElementById('restart-button');
    this.damageFlash = document.getElementById('damage-flash');
    this.loadingScreen = document.getElementById('loading-screen');
    this.loadingBarFill = document.getElementById('loading-bar-fill');
    this.loadingText = document.getElementById('loading-text');
    this.respawnOverlay = document.getElementById('respawn-overlay');
    this.respawnSeconds = document.getElementById('respawn-seconds');
    this.pauseButton = document.getElementById('pause-button');
    this.pauseOverlay = document.getElementById('pause-overlay');
    this.resumeButton = document.getElementById('resume-button');
    this.quitButton = document.getElementById('quit-button');
    this.difficultyButtons = [...document.querySelectorAll('.difficulty-btn')];

    this._hitMarkerTimeout = null;
    this._damageFlashTimeout = null;
    this._damageIndicatorTimeout = null;
  }

  setPlayerCard(side, { lives, healthPct, ammo, magSize, reserve, reloading, weaponName, weaponIcon, isDown }) {
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

    if (weaponName) this.weaponName[side].textContent = weaponName;
    if (weaponIcon) this.weaponIcon[side].textContent = weaponIcon;

    this.downTag[side].classList.toggle('hidden', !isDown);
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

  // angleDeg: 0 = threat is "ahead" on screen, increases clockwise.
  flashDamageDirection(angleDeg) {
    this.damageIndicator.style.transform = `rotate(${angleDeg}deg)`;
    this.damageIndicator.classList.remove('show');
    void this.damageIndicator.offsetWidth;
    this.damageIndicator.classList.add('show');
    clearTimeout(this._damageIndicatorTimeout);
    this._damageIndicatorTimeout = setTimeout(() => this.damageIndicator.classList.remove('show'), 1000);
  }

  setLoadingProgress(pct) {
    const clamped = Math.min(100, Math.max(0, Math.round(pct)));
    this.loadingBarFill.style.width = `${clamped}%`;
    this.loadingText.textContent = `Loading… ${clamped}%`;
  }

  hideLoadingScreen() {
    this.loadingScreen.classList.add('hidden');
  }

  showRespawnCountdown(seconds) {
    this.respawnOverlay.classList.remove('hidden');
    this.respawnSeconds.textContent = Math.max(1, Math.ceil(seconds));
  }

  hideRespawnCountdown() {
    this.respawnOverlay.classList.add('hidden');
  }

  showStart(onStart) {
    this.startScreen.classList.remove('hidden');
    this.endScreen.classList.add('hidden');
    this.startButton.onclick = onStart;
  }

  hideStart() {
    this.startScreen.classList.add('hidden');
  }

  // Wires the Easy/Normal/Hard buttons; onChange(difficulty) fires on selection.
  bindDifficultySelect(onChange) {
    for (const btn of this.difficultyButtons) {
      btn.onclick = () => {
        for (const b of this.difficultyButtons) b.classList.remove('selected');
        btn.classList.add('selected');
        onChange(btn.dataset.difficulty);
      };
    }
  }

  bindPause(onPause, onResume, onQuit) {
    this.pauseButton.onclick = onPause;
    this.resumeButton.onclick = onResume;
    this.quitButton.onclick = onQuit;
  }

  showPause() {
    this.pauseOverlay.classList.remove('hidden');
  }

  hidePause() {
    this.pauseOverlay.classList.add('hidden');
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
