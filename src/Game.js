import * as THREE from 'three';
import { AssetLoader } from './AssetLoader.js';
import { Arena, ARENA_HALF } from './Arena.js';
import { Player } from './Player.js';
import { Enemy } from './Enemy.js';
import { Input } from './Input.js';
import { HUD } from './HUD.js';
import { TouchControls } from './TouchControls.js';
import { AudioManager } from './AudioManager.js';
import { MiniMap } from './MiniMap.js';
import { WeaponPickups, PICKUP_POSITIONS } from './WeaponPickups.js';
import { EXPLOSION_RADIUS, EXPLOSION_DAMAGE, MINE_DAMAGE } from './Hazards.js';
import { clamp } from './utils.js';

const PLAYER_SPAWN = new THREE.Vector3(0, 0, 20);
const ENEMY_SPAWN = new THREE.Vector3(0, 0, -20);

// Camera looks down at this fixed angle (preserved from the reference image)
// but slides along it and dollies in/out so both fighters stay framed,
// instead of rigidly following the player alone.
const CAMERA_DIRECTION = new THREE.Vector3(0, 17, 11).normalize();
const CAMERA_MIN_DIST = 20;
const CAMERA_MAX_DIST = 80;
const CAMERA_ZOOM_FACTOR = 1.0;
const ROUND_TIME = 120;
const RESPAWN_DELAY = 1.8;

function createFlashTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,220,120,0.9)');
  gradient.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.domElement.id = 'game-canvas';
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);

    this.clock = new THREE.Clock();
    this.input = new Input();
    this.assetLoader = new AssetLoader();
    this.hud = new HUD();
    this.audio = new AudioManager();
    this._flashTexture = createFlashTexture();

    this.arena = new Arena(this.scene, this.assetLoader);
    this.player = new Player(this.scene, this.arena.bounds, this.arena.colliders);
    this.enemy = new Enemy(this.scene, this.arena.bounds, this.arena.colliders);
    this.weaponPickups = new WeaponPickups(this.scene);

    this.state = 'loading'; // loading | ready | playing | paused | ended
    this._tracers = [];
    this._flashes = [];
    this._particles = [];
    this._playerRespawnTimer = 0;
    this._enemyRespawnTimer = 0;
    this._roundTime = ROUND_TIME;
    this._mouseHeld = false;
    this._difficulty = 'normal';

    this._mouseNDC = new THREE.Vector2();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._aimRaycaster = new THREE.Raycaster();
    this._aimPoint = new THREE.Vector3();

    window.addEventListener('resize', () => this._onResize());
  }

  async init() {
    const progressTimer = setInterval(() => {
      this.hud.setLoadingProgress(this.assetLoader.progress * 100);
    }, 100);

    await this.arena.build([PLAYER_SPAWN, ENEMY_SPAWN], PICKUP_POSITIONS);
    await this.player.load(this.assetLoader, PLAYER_SPAWN);
    await this.enemy.load(this.assetLoader, ENEMY_SPAWN);
    await this.weaponPickups.load(this.assetLoader);
    await this.audio.load('gunshot', '/assets/sounds/gunshot.mp3');

    clearInterval(progressTimer);
    this.hud.setLoadingProgress(100);
    this.hud.hideLoadingScreen();

    this.minimap = new MiniMap(document.getElementById('minimap'), ARENA_HALF, this.arena.colliders);

    await this._resetMatch();

    window.addEventListener('mousemove', (e) => this._onMouseMove(e));
    window.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this._mouseHeld = true;
      this._onFire();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      this._mouseHeld = false;
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this._togglePause();
    });

    this.touchControls = new TouchControls(this.input, {
      onReload: () => this.player.reload(),
    });
    this._setupOrientation();

    this.hud.bindDifficultySelect((level) => {
      this._difficulty = level;
    });
    this.hud.bindPause(
      () => this._togglePause(),
      () => this._resume(),
      () => this._quitToMenu()
    );

    this.state = 'ready';
    const instructions = this.touchControls.active
      ? 'Left stick to move · Hold the right button to aim & fire · Tap RELOAD to reload'
      : 'WASD to move · Mouse to aim · Click to shoot · R to reload';
    document.getElementById('start-instructions').textContent = instructions;
    this.hud.showStart(() => this._begin());

    this._animate();
  }

  // iOS Safari has no working screen.orientation.lock() for a plain web
  // page, so the reliable cross-device approach is: try the lock where the
  // API exists (Android/PWA contexts), and otherwise block play with a
  // "rotate your device" prompt whenever a touch device is in portrait.
  _setupOrientation() {
    if (screen.orientation?.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }

    this._orientationBlocked = false;
    if (!this.touchControls.active) return;

    const prompt = document.getElementById('rotate-prompt');
    const checkOrientation = () => {
      this._orientationBlocked = window.innerHeight > window.innerWidth;
      prompt.classList.toggle('hidden', !this._orientationBlocked);
    };
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    window.matchMedia('(orientation: portrait)').addEventListener('change', checkOrientation);
    checkOrientation();
  }

  _begin() {
    this.hud.hideStart();
    this.enemy.setDifficulty(this._difficulty);
    this.state = 'playing';
  }

  _togglePause() {
    if (this.state === 'playing') this._pause();
    else if (this.state === 'paused') this._resume();
  }

  _pause() {
    this.state = 'paused';
    this.hud.showPause();
  }

  _resume() {
    this.state = 'playing';
    this.hud.hidePause();
  }

  _quitToMenu() {
    this.hud.hidePause();
    this._resetMatch().then(() => {
      this.state = 'ready';
      this.hud.showStart(() => this._begin());
    });
  }

  _onMouseMove(e) {
    this._mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    this._mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  _updateAimPoint() {
    this._aimRaycaster.setFromCamera(this._mouseNDC, this.camera);
    this._aimRaycaster.ray.intersectPlane(this._groundPlane, this._aimPoint);
  }

  _shootTargets() {
    return [...this.arena.obstacleModels, ...this.arena.hazards.explosiveModels];
  }

  _onFire() {
    if (this.state !== 'playing' || this.player.isDown) return;

    if (this.player.ammo === 0) {
      this.player.reload();
      return;
    }
    if (!this.player.canShoot()) return;

    const result = this.player.shoot(this.enemy.model, this._shootTargets());
    this.audio.play('gunshot', { volume: 0.6, rate: 0.95 + Math.random() * 0.1 });
    this._spawnMuzzleFlash(result.origin);
    if (navigator.vibrate) navigator.vibrate(15);

    let totalDamage = 0;
    for (const pellet of result.pellets) {
      this._spawnTracer(result.origin, pellet.point, 0xffe066);
      if (pellet.hit) {
        totalDamage += pellet.damage;
        this._spawnImpactBurst(pellet.point, 0xffe066);
      } else if (pellet.blockedObject) {
        this._handlePossibleHazardHit(pellet.blockedObject, pellet.point);
      }
    }

    if (totalDamage > 0) {
      this.enemy.takeDamage(totalDamage, this.player.position);
      this.hud.flashHitMarker();
      this._refreshHud();
      if (this.enemy.health === 0) {
        this._onFighterDown(this.enemy, 'enemy');
      }
    }
  }

  _handlePossibleHazardHit(blockedObject, point) {
    const hazard = this.arena.hazards.findExplosiveForObject(blockedObject);
    if (hazard) {
      this._triggerExplosion(hazard.position, EXPLOSION_DAMAGE, EXPLOSION_RADIUS);
      this.arena.hazards.consume(hazard);
    } else {
      this._spawnImpactBurst(point, 0xdddddd);
    }
  }

  _computeThreatAngleDeg(threatPos) {
    const dx = threatPos.x - this.player.position.x;
    const dz = threatPos.z - this.player.position.z;
    return Math.atan2(dx, -dz) * (180 / Math.PI);
  }

  _triggerExplosion(position, damage = EXPLOSION_DAMAGE, radius = EXPLOSION_RADIUS) {
    this.audio.playExplosion(0.8);
    if (navigator.vibrate) navigator.vibrate(100);

    const flash = new THREE.PointLight(0xffaa33, 8, 14);
    flash.position.copy(position);
    flash.position.y = 1.2;
    this.scene.add(flash);
    this._flashes.push({ light: flash, expires: performance.now() + 180 });

    this._spawnImpactBurst(position.clone().setY(0.8), 0xffaa33, 18, 4.5);

    for (const fighter of [this.player, this.enemy]) {
      if (fighter.isDown) continue;
      if (fighter.position.distanceTo(position) < radius) {
        fighter.takeDamage(damage, position);
        if (fighter === this.player) {
          this.hud.flashDamage();
          this.hud.flashDamageDirection(this._computeThreatAngleDeg(position));
        }
        this._refreshHud();
        if (fighter.health === 0) {
          this._onFighterDown(fighter, fighter === this.player ? 'player' : 'enemy');
        }
      }
    }
  }

  _onFighterDown(fighter, side) {
    const livesLeft = fighter.loseLife();
    this._refreshHud();
    if (livesLeft <= 0) {
      this._endGame(side === 'enemy' ? 'player' : 'enemy');
      return;
    }
    if (side === 'player') this._playerRespawnTimer = RESPAWN_DELAY;
    else this._enemyRespawnTimer = RESPAWN_DELAY;
  }

  _endGame(winner) {
    this.state = 'ended';
    this.hud.hideRespawnCountdown();
    this.hud.showEnd(winner, () => this._restart());
  }

  async _resetMatch() {
    await this.player.reset(PLAYER_SPAWN);
    this.enemy.reset(ENEMY_SPAWN);
    this._playerRespawnTimer = 0;
    this._enemyRespawnTimer = 0;
    this._roundTime = ROUND_TIME;
    this.hud.hideRespawnCountdown();
    this._updateCamera();
    this._refreshHud();
    this.hud.setTimer(this._roundTime);
  }

  async _restart() {
    await this._resetMatch();
    this.hud.hideEnd();
    this.state = 'ready';
    this.hud.showStart(() => this._begin());
  }

  _refreshHud() {
    this.hud.setPlayerCard('player', {
      lives: this.player.lives,
      healthPct: (this.player.health / this.player.maxHealth) * 100,
      ammo: this.player.ammo,
      magSize: this.player.magSize,
      reserve: this.player.reserve,
      reloading: this.player.isReloading,
      weaponName: this.player.weaponDef.name,
      weaponIcon: this.player.weaponDef.icon,
      isDown: this.player.isDown,
    });
    this.hud.setPlayerCard('enemy', {
      lives: this.enemy.lives,
      healthPct: (this.enemy.health / this.enemy.maxHealth) * 100,
      ammo: this.enemy.ammo,
      magSize: this.enemy.magSize,
      reserve: this.enemy.reserve,
      reloading: this.enemy.isReloading,
      weaponName: this.enemy.weaponDef.name,
      weaponIcon: this.enemy.weaponDef.icon,
      isDown: this.enemy.isDown,
    });
  }

  _spawnTracer(from, to, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this._tracers.push({ line, expires: performance.now() + 90, duration: 90 });
  }

  _spawnMuzzleFlash(position) {
    const light = new THREE.PointLight(0xffcc66, 4, 5);
    light.position.copy(position);
    this.scene.add(light);

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this._flashTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    sprite.position.copy(position);
    sprite.scale.setScalar(0.7);
    this.scene.add(sprite);

    this._flashes.push({ light, sprite, expires: performance.now() + 70 });
  }

  _spawnImpactBurst(position, color = 0xffffff, count = 8, speed = 3) {
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      velocities.push(
        new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.abs(Math.cos(phi)) * 0.6 + 0.2, Math.sin(phi) * Math.sin(theta)).multiplyScalar(
          speed * (0.5 + Math.random() * 0.5)
        )
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color, size: 0.14, transparent: true, opacity: 1, depthWrite: false });
    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this._particles.push({ points, velocities, expires: performance.now() + 320 });
  }

  _updateEffects(delta) {
    const now = performance.now();

    this._tracers = this._tracers.filter((t) => {
      const lifeLeft = t.expires - now;
      if (lifeLeft <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        return false;
      }
      t.line.material.opacity = Math.max(0, lifeLeft / t.duration) * 0.9;
      return true;
    });

    this._flashes = this._flashes.filter((f) => {
      if (now >= f.expires) {
        this.scene.remove(f.light);
        if (f.sprite) {
          this.scene.remove(f.sprite);
          f.sprite.material.dispose();
        }
        return false;
      }
      return true;
    });

    this._particles = this._particles.filter((p) => {
      if (now >= p.expires) {
        this.scene.remove(p.points);
        p.points.geometry.dispose();
        p.points.material.dispose();
        return false;
      }
      const posAttr = p.points.geometry.attributes.position;
      for (let i = 0; i < p.velocities.length; i++) {
        posAttr.array[i * 3] += p.velocities[i].x * delta;
        posAttr.array[i * 3 + 1] += p.velocities[i].y * delta;
        posAttr.array[i * 3 + 2] += p.velocities[i].z * delta;
        p.velocities[i].y -= 6 * delta;
      }
      posAttr.needsUpdate = true;
      p.points.material.opacity = Math.max(0, (p.expires - now) / 320);
      return true;
    });
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Frames both fighters: follows their midpoint and dollies back along a
  // fixed viewing angle as they spread apart, instead of rigidly tracking
  // the player alone (which left the enemy off-screen whenever they were
  // more than a few units away).
  _updateCamera() {
    const midX = (this.player.position.x + this.enemy.position.x) / 2;
    const midZ = (this.player.position.z + this.enemy.position.z) / 2;
    const separation = Math.hypot(
      this.player.position.x - this.enemy.position.x,
      this.player.position.z - this.enemy.position.z
    );
    const dist = clamp(CAMERA_MIN_DIST + separation * CAMERA_ZOOM_FACTOR, CAMERA_MIN_DIST, CAMERA_MAX_DIST);

    this.camera.position.set(
      midX + CAMERA_DIRECTION.x * dist,
      CAMERA_DIRECTION.y * dist,
      midZ + CAMERA_DIRECTION.z * dist
    );
    this.camera.lookAt(midX, 1, midZ);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const delta = Math.min(this.clock.getDelta(), 0.1);

    if (this.touchControls?.active) {
      // No mouse on a touchscreen: aim toward the opponent while the fire button is held.
      this._aimPoint.copy(this.enemy.position);
    } else {
      this._updateAimPoint();
    }

    if (this.state === 'playing' && !this._orientationBlocked) {
      this.player.update(delta, this.input, this._aimPoint);
      if (this.input.isDown('KeyR')) this.player.reload();
      if (this._mouseHeld || this.touchControls?.firing) this._onFire();

      this.enemy.update(delta, this.player.position, this.player.model, this._shootTargets());
      const shot = this.enemy.consumeShot();
      if (shot) {
        this.audio.play('gunshot', { volume: 0.4, rate: 0.95 + Math.random() * 0.1 });
        this._spawnMuzzleFlash(shot.origin);
        this._spawnTracer(shot.origin, shot.point, 0xff5555);
        if (shot.hit) {
          this.player.takeDamage(shot.damage, shot.origin);
          this.hud.flashDamage();
          this.hud.flashDamageDirection(this._computeThreatAngleDeg(shot.origin));
          if (navigator.vibrate) navigator.vibrate(60);
          this._spawnImpactBurst(shot.point, 0xff5555);
          this._refreshHud();
          if (this.player.health === 0) {
            this._onFighterDown(this.player, 'player');
          }
        } else if (shot.blockedObject) {
          this._handlePossibleHazardHit(shot.blockedObject, shot.point);
        }
      }

      this.weaponPickups.update(delta, this.player, (weaponDef) => {
        this.player.equipWeapon(weaponDef).then(() => this._refreshHud());
      });

      for (const mine of this.arena.hazards.checkMineProximity(this.player.position)) {
        this.arena.hazards.consume(mine);
        this._triggerExplosion(mine.position, MINE_DAMAGE, EXPLOSION_RADIUS);
      }
      if (!this.enemy.isDown) {
        for (const mine of this.arena.hazards.checkMineProximity(this.enemy.position)) {
          this.arena.hazards.consume(mine);
          this._triggerExplosion(mine.position, MINE_DAMAGE, EXPLOSION_RADIUS);
        }
      }

      if (this._playerRespawnTimer > 0) {
        this._playerRespawnTimer -= delta;
        if (this._playerRespawnTimer <= 0) {
          this.player.respawn(PLAYER_SPAWN);
          this.hud.hideRespawnCountdown();
          this._refreshHud();
        } else {
          this.hud.showRespawnCountdown(this._playerRespawnTimer);
        }
      }
      if (this._enemyRespawnTimer > 0) {
        this._enemyRespawnTimer -= delta;
        if (this._enemyRespawnTimer <= 0) {
          this.enemy.respawn(ENEMY_SPAWN);
          this._refreshHud();
        }
      }

      this._roundTime = Math.max(0, this._roundTime - delta);
      this.hud.setTimer(this._roundTime);
      if (this._roundTime === 0) {
        this._endGame(this._decideTimeUpWinner());
      }
    }

    this._updateCamera();
    this._updateEffects(delta);
    if (this.minimap) {
      this.minimap.update(this.player.position, this.player.model.rotation.y, this.enemy.position, this.enemy.model.visible);
    }
    this.renderer.render(this.scene, this.camera);
  }

  _decideTimeUpWinner() {
    if (this.player.lives !== this.enemy.lives) {
      return this.player.lives > this.enemy.lives ? 'player' : 'enemy';
    }
    if (this.player.health !== this.enemy.health) {
      return this.player.health > this.enemy.health ? 'player' : 'enemy';
    }
    return 'draw';
  }
}
