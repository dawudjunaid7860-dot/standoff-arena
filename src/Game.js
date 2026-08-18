import * as THREE from 'three';
import { AssetLoader } from './AssetLoader.js';
import { Arena } from './Arena.js';
import { Player } from './Player.js';
import { Enemy } from './Enemy.js';
import { Input } from './Input.js';
import { HUD } from './HUD.js';

const PLAYER_SPAWN = new THREE.Vector3(0, 0, 28);
const ENEMY_SPAWN = new THREE.Vector3(0, 0, -28);

const CAMERA_OFFSET = new THREE.Vector3(0, 17, 11);
const ROUND_TIME = 120;
const RESPAWN_DELAY = 1.8;

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

    this.arena = new Arena(this.scene, this.assetLoader);
    this.player = new Player(this.scene, this.arena.bounds, this.arena.colliders);
    this.enemy = new Enemy(this.scene, this.arena.bounds, this.arena.colliders);

    this.state = 'loading'; // loading | ready | playing | ended
    this._tracers = [];
    this._flashes = [];
    this._playerRespawnTimer = 0;
    this._enemyRespawnTimer = 0;
    this._roundTime = ROUND_TIME;
    this._mouseHeld = false;

    this._mouseNDC = new THREE.Vector2();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._aimRaycaster = new THREE.Raycaster();
    this._aimPoint = new THREE.Vector3();

    window.addEventListener('resize', () => this._onResize());
  }

  async init() {
    await this.arena.build([PLAYER_SPAWN, ENEMY_SPAWN]);
    await this.player.load(this.assetLoader, PLAYER_SPAWN);
    await this.enemy.load(this.assetLoader, ENEMY_SPAWN);

    this._resetMatch();

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

    this.state = 'ready';
    this.hud.showStart(() => this._begin());

    this._animate();
  }

  _begin() {
    this.hud.hideStart();
    this.state = 'playing';
  }

  _onMouseMove(e) {
    this._mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    this._mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  _updateAimPoint() {
    this._aimRaycaster.setFromCamera(this._mouseNDC, this.camera);
    this._aimRaycaster.ray.intersectPlane(this._groundPlane, this._aimPoint);
  }

  _onFire() {
    if (this.state !== 'playing' || this.player.isDown) return;

    if (this.player.ammo === 0) {
      this.player.reload();
      return;
    }
    if (!this.player.canShoot()) return;

    const result = this.player.shoot(this.enemy.model, this.arena.obstacleModels);
    this._spawnMuzzleFlash(result.origin);
    this._spawnTracer(result.origin, result.point, 0xffe066);

    if (result.hit) {
      this.enemy.takeDamage(result.damage);
      this.hud.flashHitMarker();
      this._refreshHud();

      if (this.enemy.health === 0) {
        this._onFighterDown(this.enemy, 'enemy');
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
    this.hud.showEnd(winner, () => this._restart());
  }

  _resetMatch() {
    this.player.reset(PLAYER_SPAWN);
    this.enemy.reset(ENEMY_SPAWN);
    this._playerRespawnTimer = 0;
    this._enemyRespawnTimer = 0;
    this._roundTime = ROUND_TIME;
    this.camera.position.copy(PLAYER_SPAWN).add(CAMERA_OFFSET);
    this.camera.lookAt(PLAYER_SPAWN.x, 1, PLAYER_SPAWN.z);
    this._refreshHud();
    this.hud.setTimer(this._roundTime);
  }

  _restart() {
    this._resetMatch();
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
    });
    this.hud.setPlayerCard('enemy', {
      lives: this.enemy.lives,
      healthPct: (this.enemy.health / this.enemy.maxHealth) * 100,
      ammo: this.enemy.ammo,
      magSize: this.enemy.magSize,
      reserve: this.enemy.reserve,
      reloading: this.enemy.isReloading,
    });
  }

  _spawnTracer(from, to, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this._tracers.push({ line, expires: performance.now() + 90 });
  }

  _spawnMuzzleFlash(position) {
    const flash = new THREE.PointLight(0xffcc66, 4, 5);
    flash.position.copy(position);
    this.scene.add(flash);
    this._flashes.push({ light: flash, expires: performance.now() + 60 });
  }

  _cleanupEffects() {
    const now = performance.now();
    this._tracers = this._tracers.filter((t) => {
      if (now >= t.expires) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        return false;
      }
      return true;
    });
    this._flashes = this._flashes.filter((f) => {
      if (now >= f.expires) {
        this.scene.remove(f.light);
        return false;
      }
      return true;
    });
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _updateCamera() {
    this.camera.position.set(
      this.player.position.x + CAMERA_OFFSET.x,
      this.player.position.y + CAMERA_OFFSET.y,
      this.player.position.z + CAMERA_OFFSET.z
    );
    this.camera.lookAt(this.player.position.x, 1, this.player.position.z);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const delta = Math.min(this.clock.getDelta(), 0.1);

    this._updateAimPoint();

    if (this.state === 'playing') {
      this.player.update(delta, this.input, this._aimPoint);
      if (this.input.isDown('KeyR')) this.player.reload();
      if (this._mouseHeld) this._onFire();

      this.enemy.update(delta, this.player.position, this.player.model, this.arena.obstacleModels);
      const shot = this.enemy.consumeShot();
      if (shot) {
        this._spawnMuzzleFlash(shot.origin);
        this._spawnTracer(shot.origin, shot.point, 0xff5555);
        if (shot.hit) {
          this.player.takeDamage(shot.damage);
          this.hud.flashDamage();
          this._refreshHud();
          if (this.player.health === 0) {
            this._onFighterDown(this.player, 'player');
          }
        }
      }

      if (this._playerRespawnTimer > 0) {
        this._playerRespawnTimer -= delta;
        if (this._playerRespawnTimer <= 0) {
          this.player.respawn(PLAYER_SPAWN);
          this._refreshHud();
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
    this._cleanupEffects();
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
