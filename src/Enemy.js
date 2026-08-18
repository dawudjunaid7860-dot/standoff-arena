import * as THREE from 'three';
import { ASSETS } from './AssetLoader.js';
import { normalizeScale, placeOnGround, enableShadows, clamp, isDescendantOf } from './utils.js';
import { attachPistol, MAG_SIZE, RESERVE_START, RELOAD_TIME, FIRE_COOLDOWN, DAMAGE } from './Weapon.js';
import { resolveCollisions } from './Collision.js';

const HEIGHT = 1.8;
const RADIUS = 0.42;
const SPEED = 4.2;
const APPROACH_DIST = 16;
const RETREAT_DIST = 7;
const MAX_SHOOT_RANGE = 34;
const MAX_RANGE = 60;
const AIM_SPREAD = 0.1; // radians of random inaccuracy either side of the true aim
const CHEST_HEIGHT_FACTOR = 0.55;

// If the model's front doesn't line up with facing-the-player after
// testing, nudge this by Math.PI or Math.PI / 2.
const FACE_OFFSET = 0;

export class Enemy {
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

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = MAX_RANGE;

    this._shootCooldown = this._randomCooldown();
    this._strafeDir = 1;
    this._strafeTimer = this._randomStrafeInterval();
    this._pendingShot = null;
  }

  async load(assetLoader, spawnPosition) {
    const model = await assetLoader.load(ASSETS.characters.enemy);
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
    this._shootCooldown = this._randomCooldown();
    this._placeAt(spawnPosition);
  }

  respawn(spawnPosition) {
    this.health = this.maxHealth;
    this.isDown = false;
    this.ammo = this.magSize;
    this.reserve = RESERVE_START;
    this.isReloading = false;
    this._reloadTimer = 0;
    this._shootCooldown = this._randomCooldown();
    this._placeAt(spawnPosition);
  }

  _placeAt(spawnPosition) {
    this.model.position.set(spawnPosition.x, this.model.position.y, spawnPosition.z);
    this.model.rotation.set(0, 0, 0);
    this.model.visible = true;
  }

  _randomCooldown() {
    return 0.9 + Math.random() * 0.9;
  }

  _randomStrafeInterval() {
    return 1.2 + Math.random() * 1.4;
  }

  update(delta, playerPosition, playerModel, obstacles) {
    this._pendingShot = null;
    if (!this.model || this.isDown) return;

    const pos = this.model.position;
    const dx = playerPosition.x - pos.x;
    const dz = playerPosition.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const dirX = dx / (dist || 1);
    const dirZ = dz / (dist || 1);

    this.model.rotation.y = Math.atan2(-dirX, -dirZ) + FACE_OFFSET;

    let moveX = 0;
    let moveZ = 0;

    this._strafeTimer -= delta;
    if (this._strafeTimer <= 0) {
      this._strafeDir *= -1;
      this._strafeTimer = this._randomStrafeInterval();
    }

    if (dist > APPROACH_DIST) {
      moveX = dirX;
      moveZ = dirZ;
    } else if (dist < RETREAT_DIST) {
      moveX = -dirX;
      moveZ = -dirZ;
    } else {
      moveX = -dirZ * this._strafeDir;
      moveZ = dirX * this._strafeDir;
    }

    const resolved = resolveCollisions(pos.x + moveX * SPEED * delta, pos.z + moveZ * SPEED * delta, RADIUS, this.colliders);
    pos.x = clamp(resolved.x, this.bounds.minX, this.bounds.maxX);
    pos.z = clamp(resolved.z, this.bounds.minZ, this.bounds.maxZ);

    if (this.isReloading) {
      this._reloadTimer -= delta;
      if (this._reloadTimer <= 0) this._finishReload();
    } else if (this.ammo === 0) {
      this._startReload();
    }

    if (this.gun && this._recoil > 0) {
      this._recoil = Math.max(0, this._recoil - delta * 6);
      this.gun.position.z = this._restGunZ + this._recoil * 0.08;
    }

    this._shootCooldown -= delta;
    if (this._shootCooldown <= 0 && dist <= MAX_SHOOT_RANGE && !this.isReloading && this.ammo > 0) {
      this._shootCooldown = this._randomCooldown();
      this._pendingShot = this._fire(playerModel, obstacles, pos, dirX, dirZ, dist);
    }
  }

  _fire(playerModel, obstacles, pos, dirX, dirZ, dist) {
    this.ammo -= 1;
    this._recoil = 1;

    const baseAngle = Math.atan2(dirX, dirZ);
    const spread = (Math.random() * 2 - 1) * AIM_SPREAD;
    const angle = baseAngle + spread;
    const aimDirX = Math.sin(angle);
    const aimDirZ = Math.cos(angle);

    const origin = new THREE.Vector3(pos.x, HEIGHT * CHEST_HEIGHT_FACTOR, pos.z);
    const dir = new THREE.Vector3(aimDirX, 0, aimDirZ).normalize();

    this.raycaster.set(origin, dir);
    const hits = this.raycaster.intersectObjects([playerModel, ...(obstacles || [])], true);

    if (hits.length > 0 && isDescendantOf(hits[0].object, playerModel)) {
      return { hit: true, damage: DAMAGE, origin, point: hits[0].point };
    }
    const point = hits.length > 0 ? hits[0].point : origin.clone().addScaledVector(dir, dist + 5);
    return { hit: false, origin, point };
  }

  // Returns the shot fired this frame ({ hit, damage, origin, point }), or null.
  consumeShot() {
    const shot = this._pendingShot;
    this._pendingShot = null;
    return shot;
  }

  canReload() {
    return !this.isReloading && this.ammo < this.magSize && this.reserve > 0;
  }

  _startReload() {
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
