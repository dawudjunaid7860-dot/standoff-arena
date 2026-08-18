import * as THREE from 'three';
import { AssetLoader } from './AssetLoader.js';
import { Arena } from './Arena.js';
import { Player } from './Player.js';
import { Enemy } from './Enemy.js';
import { Input } from './Input.js';
import { HUD } from './HUD.js';

const PLAYER_SPAWN = new THREE.Vector3(0, 0, 11);
const ENEMY_SPAWN = new THREE.Vector3(0, 0, -11);

export class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.domElement.id = 'game-canvas';
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

    this.clock = new THREE.Clock();
    this.input = new Input();
    this.assetLoader = new AssetLoader();
    this.hud = new HUD();

    this.arena = new Arena(this.scene, this.assetLoader);
    this.player = new Player(this.camera, this.renderer.domElement, this.scene, this.arena.bounds);
    this.enemy = new Enemy(this.scene, this.arena.bounds);

    this.state = 'loading'; // loading | ready | playing | ended
    this._tracers = [];
    this._flashes = [];

    window.addEventListener('resize', () => this._onResize());
  }

  async init() {
    await this.arena.build();
    await this.player.loadWeapon(this.assetLoader);
    await this.enemy.load(this.assetLoader, ENEMY_SPAWN);

    this.player.reset(PLAYER_SPAWN);
    this.hud.setPlayerHealth(100);
    this.hud.setEnemyHealth(100);

    this.player.controls.addEventListener('lock', () => {
      this.hud.hideStart();
      if (this.state !== 'ended') this.state = 'playing';
    });
    this.player.controls.addEventListener('unlock', () => {
      if (this.state === 'playing') {
        this.state = 'ready';
        this.hud.showStart(() => this.player.controls.lock());
      }
    });

    document.addEventListener('mousedown', () => this._onFire());

    this.state = 'ready';
    this.hud.showStart(() => this.player.controls.lock());

    this._animate();
  }

  _onFire() {
    if (this.state !== 'playing' || !this.player.canShoot() || this.enemy.isDead) return;

    const result = this.player.shoot(this.enemy.model);
    this._spawnMuzzleFlash(this._playerMuzzlePosition());

    if (result.hit) {
      this.enemy.takeDamage(result.damage);
      this.hud.setEnemyHealth((this.enemy.health / this.enemy.maxHealth) * 100);
      this.hud.flashHitMarker();
      this._spawnTracer(this._playerMuzzlePosition(), result.point, 0xffe066);

      if (this.enemy.isDead) {
        this._endGame(true);
      }
    }
  }

  _playerMuzzlePosition() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return this.camera.position.clone().addScaledVector(dir, 0.6);
  }

  _endGame(didWin) {
    this.state = 'ended';
    this.player.controls.unlock();
    this.hud.showEnd(didWin, () => this._restart());
  }

  _restart() {
    this.player.reset(PLAYER_SPAWN);
    this.enemy.reset(ENEMY_SPAWN);
    this.hud.setPlayerHealth(100);
    this.hud.setEnemyHealth(100);
    this.hud.hideEnd();
    this.state = 'ready';
    this.player.controls.lock();
  }

  _spawnTracer(from, to, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this._tracers.push({ line, expires: performance.now() + 90 });
  }

  _spawnMuzzleFlash(position) {
    const flash = new THREE.PointLight(0xffcc66, 4, 4);
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

  _animate() {
    requestAnimationFrame(() => this._animate());
    const delta = Math.min(this.clock.getDelta(), 0.1);

    this.player.update(delta, this.input);

    if (this.state === 'playing') {
      this.enemy.update(delta, this.player.position);

      const shot = this.enemy.consumeShot();
      if (shot) {
        const muzzlePos = this.enemy.getMuzzleWorldPosition();
        this._spawnMuzzleFlash(muzzlePos);
        if (shot.hit) {
          this.player.takeDamage(shot.damage);
          this.hud.setPlayerHealth((this.player.health / this.player.maxHealth) * 100);
          this.hud.flashDamage();
          this._spawnTracer(muzzlePos, this.camera.position, 0xff5555);

          if (this.player.health === 0) {
            this._endGame(false);
          }
        } else {
          this._spawnTracer(muzzlePos, this.camera.position.clone().add(
            new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 2)
          ), 0xff5555);
        }
      }
    }

    this._cleanupEffects();
    this.renderer.render(this.scene, this.camera);
  }
}
