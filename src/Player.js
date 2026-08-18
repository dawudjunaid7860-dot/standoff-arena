import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { ASSETS } from './AssetLoader.js';
import { normalizeScale, clamp } from './utils.js';

const EYE_HEIGHT = 1.6;
const MOVE_SPEED = 6;
const FIRE_COOLDOWN = 0.28;
const DAMAGE = 14;
const MAX_RANGE = 60;

export class Player {
  constructor(camera, domElement, scene, bounds) {
    this.camera = camera;
    this.scene = scene;
    this.bounds = bounds;

    this.controls = new PointerLockControls(camera, domElement);
    scene.add(this.controls.object);

    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.cooldown = 0;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = MAX_RANGE;

    this.weapon = null;
    this._recoil = 0;
    this._restZ = 0;
  }

  async loadWeapon(assetLoader) {
    const gun = await assetLoader.load(ASSETS.guns.pistol);
    normalizeScale(gun, 0.32);
    gun.rotation.y = Math.PI;
    gun.position.set(0.28, -0.32, -0.55);
    this.camera.add(gun);
    this.weapon = gun;
    this._restZ = gun.position.z;
  }

  reset(spawnPosition) {
    this.health = this.maxHealth;
    this.cooldown = 0;
    this._recoil = 0;
    this.camera.position.set(spawnPosition.x, EYE_HEIGHT, spawnPosition.z);
    this.camera.rotation.set(0, 0, 0);
  }

  update(delta, input) {
    if (this.controls.isLocked) {
      const forward = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
      const right = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);

      if (forward !== 0 || right !== 0) {
        const len = Math.hypot(forward, right) || 1;
        this.controls.moveForward((forward / len) * MOVE_SPEED * delta);
        this.controls.moveRight((right / len) * MOVE_SPEED * delta);
      }

      const pos = this.camera.position;
      pos.x = clamp(pos.x, this.bounds.minX, this.bounds.maxX);
      pos.z = clamp(pos.z, this.bounds.minZ, this.bounds.maxZ);
      pos.y = EYE_HEIGHT;
    }

    if (this.cooldown > 0) this.cooldown -= delta;

    if (this.weapon && this._recoil > 0) {
      this._recoil = Math.max(0, this._recoil - delta * 5);
      this.weapon.position.z = this._restZ - this._recoil * 0.12;
    }
  }

  canShoot() {
    return this.controls.isLocked && this.cooldown <= 0 && this.health > 0;
  }

  shoot(targetObject) {
    this.cooldown = FIRE_COOLDOWN;
    this._recoil = 1;

    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    const hits = this.raycaster.intersectObject(targetObject, true);
    if (hits.length > 0) {
      return { hit: true, damage: DAMAGE, point: hits[0].point };
    }
    return { hit: false, point: null };
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health;
  }

  get position() {
    return this.camera.position;
  }
}
