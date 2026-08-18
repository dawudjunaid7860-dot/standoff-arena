import * as THREE from 'three';
import { ASSETS } from './AssetLoader.js';
import { normalizeScale, placeOnGround, enableShadows, clamp, isDescendantOf } from './utils.js';
import { attachPistol, MAG_SIZE, RESERVE_START, RELOAD_TIME, FIRE_COOLDOWN, DAMAGE } from './Weapon.js';
import { resolveCollisions } from './Collision.js';

const HEIGHT = 1.8;
const RADIUS = 0.42;
const MOVE_SPEED = 7;
const MAX_RANGE = 60;
const CHEST_HEIGHT_FACTOR = 0.55;

// If the model's front doesn't line up with the aim direction after
// testing, nudge this by Math.PI or Math.PI / 2.
const FACE_OFFSET = 0;

export class Player {
  constructor(scene, bounds, colliders) {
    this.scene = scene;
    this.bounds = bounds;
    this.colliders = colliders;

    this.model = null;
    this.gun = null;
    this._restGunZ = 0;
    this._recoil = 0;

    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.maxLives = 3;
    this.lives = this.maxLives;
    this.isDown = false;

    this.magSize = MAG_SIZE;
    this.ammo = MAG_SIZE;
    this.reserve = RESERVE_START;
    this.isReloading = false;
    this._reloadTimer = 0;

    this.cooldown = 0;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = MAX_RANGE;
    this.aimPoint = new THREE.Vector3();
  }

  async load(assetLoader, spawnPosition) {
    const model = await assetLoader.load(ASSETS.characters.soldier);
    normalizeScale(model, HEIGHT);
    placeOnGround(model, spawnPosition.x, spawnPosition.z);
    enableShadows(model);
    this.scene.add(model);
    this.model = model;

    this.gun = await attachPistol(assetLoader, model, HEIGHT);
    this._restGunZ = this.gun.position.z;
  }

  reset(spawnPosition) {
    this.health = this.maxHealth;
    this.lives = this.maxLives;
    this.isDown = false;
    this.ammo = this.magSize;
    this.reserve = RESERVE_START;
    this.isReloading = false;
    this._reloadTimer = 0;
    this.cooldown = 0;
    this._placeAt(spawnPosition);
  }

  respawn(spawnPosition) {
    this.health = this.maxHealth;
    this.isDown = false;
    this.ammo = this.magSize;
    this.reserve = RESERVE_START;
    this.isReloading = false;
    this._reloadTimer = 0;
    this._placeAt(spawnPosition);
  }

  _placeAt(spawnPosition) {
    this.model.position.set(spawnPosition.x, this.model.position.y, spawnPosition.z);
    this.model.rotation.set(0, 0, 0);
    this.model.visible = true;
  }

  update(delta, input, aimWorldPoint) {
    if (this.isDown) return;

    const pos = this.model.position;
    const { forward, strafe } = input.getMoveAxes();
    const magnitude = Math.hypot(forward, strafe);

    // Unit-vector for keyboard (always full speed); proportional for a
    // partially-deflected touch joystick, capped at magnitude 1 either way.
    if (magnitude > 0.001) {
      const speedScale = Math.min(magnitude, 1);
      const moveX = (strafe / magnitude) * speedScale * MOVE_SPEED * delta;
      const moveZ = (-forward / magnitude) * speedScale * MOVE_SPEED * delta;
      const resolved = resolveCollisions(pos.x + moveX, pos.z + moveZ, RADIUS, this.colliders);
      pos.x = clamp(resolved.x, this.bounds.minX, this.bounds.maxX);
      pos.z = clamp(resolved.z, this.bounds.minZ, this.bounds.maxZ);
    }

    if (aimWorldPoint) {
      this.aimPoint.copy(aimWorldPoint);
      const dx = aimWorldPoint.x - pos.x;
      const dz = aimWorldPoint.z - pos.z;
      if (Math.hypot(dx, dz) > 0.05) {
        this.model.rotation.y = Math.atan2(-dx, -dz) + FACE_OFFSET;
      }
    }

    if (this.cooldown > 0) this.cooldown -= delta;

    if (this.isReloading) {
      this._reloadTimer -= delta;
      if (this._reloadTimer <= 0) this._finishReload();
    }

    if (this.gun && this._recoil > 0) {
      this._recoil = Math.max(0, this._recoil - delta * 6);
      this.gun.position.z = this._restGunZ + this._recoil * 0.08;
    }
  }

  canShoot() {
    return !this.isDown && this.cooldown <= 0 && !this.isReloading && this.ammo > 0;
  }

  // obstacles: solid props/walls that can block the shot before it reaches the target.
  shoot(targetObject, obstacles) {
    this.cooldown = FIRE_COOLDOWN;
    this.ammo -= 1;
    this._recoil = 1;

    const pos = this.model.position;
    const origin = new THREE.Vector3(pos.x, HEIGHT * CHEST_HEIGHT_FACTOR, pos.z);
    const dir = new THREE.Vector3(this.aimPoint.x - origin.x, 0, this.aimPoint.z - origin.z);
    if (dir.lengthSq() < 0.0001) dir.set(0, 0, -1);
    dir.normalize();

    this.raycaster.set(origin, dir);
    const hits = this.raycaster.intersectObjects([targetObject, ...(obstacles || [])], true);
    if (hits.length > 0 && isDescendantOf(hits[0].object, targetObject)) {
      return { hit: true, damage: DAMAGE, point: hits[0].point, origin };
    }
    const point = hits.length > 0 ? hits[0].point : origin.clone().addScaledVector(dir, MAX_RANGE);
    return { hit: false, point, origin };
  }

  canReload() {
    return !this.isReloading && this.ammo < this.magSize && this.reserve > 0;
  }

  reload() {
    if (!this.canReload()) return;
    this.isReloading = true;
    this._reloadTimer = RELOAD_TIME;
  }

  _finishReload() {
    this.isReloading = false;
    const needed = this.magSize - this.ammo;
    const take = Math.min(needed, this.reserve);
    this.ammo += take;
    this.reserve -= take;
  }

  takeDamage(amount) {
    if (this.isDown) return this.health;
    this.health = Math.max(0, this.health - amount);
    return this.health;
  }

  loseLife() {
    this.lives = Math.max(0, this.lives - 1);
    this.isDown = true;
    this.model.visible = false;
    return this.lives;
  }

  get position() {
    return this.model.position;
  }
}
