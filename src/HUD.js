export class HUD {
  constructor() {
    this.playerFill = document.getElementById('player-health-fill');
    this.enemyFill = document.getElementById('enemy-health-fill');
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

  setPlayerHealth(pct) {
    this.playerFill.style.width = `${Math.max(0, pct)}%`;
  }

  setEnemyHealth(pct) {
    this.enemyFill.style.width = `${Math.max(0, pct)}%`;
  }

  flashHitMarker() {
    this.hitMarker.classList.remove('show');
    // Force reflow so the animation restarts on rapid consecutive hits.
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

  showEnd(didWin, onRestart) {
    this.endScreen.classList.remove('hidden');
    this.endTitle.textContent = didWin ? 'YOU WIN' : 'YOU LOSE';
    this.endTitle.className = didWin ? 'win' : 'lose';
    this.restartButton.onclick = onRestart;
  }

  hideEnd() {
    this.endScreen.classList.add('hidden');
  }
}
