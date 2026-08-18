import * as THREE from 'three';
import { ASSETS } from './AssetLoader.js';
import { normalizeScale, placeOnGround, enableShadows, clamp } from './utils.js';

const HEIGHT = 1.85;
const GUN_SIZE = 0.32;
const SPEED = 3.4;
const APPROACH_DIST = 12;
const RETREAT_DIST = 6;
const MAX_SHOOT_RANGE = 24;
const HIT_CHANCE = 0.55;
const DAMAGE_MIN = 8;
const DAMAGE_MAX = 14;

// If the model's front doesn't line up with facing-the-player after testing,
// nudge this by Math.PI or Math.PI / 2.
const FACE_OFFSET = 0;

export class Enemy {
  constructor(scene, bounds) {
    this.scene = scene;
    this.bounds = bounds;
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.model = null;
    this.gun = null;
    this.isDead = false;

    this._shootCooldown = this._randomCooldown();
    this._strafeDir = 1;
    this._strafeTimer = this._randomStrafeInterval();
  }

  async load(assetLoader, spawnPosition) {
    const model = await assetLoader.load(ASSETS.characters.enemy);
    normalizeScale(model, HEIGHT);
    placeOnGround(model, spawnPosition.x, spawnPosition.z);
    enableShadows(model);
    this.scene.add(model);
    this.model = model;

    const gun = await assetLoader.load(ASSETS.guns.pistol);
    normalizeScale(gun, GUN_SIZE);
    gun.position.set(0.4, HEIGHT * 0.6, 0.25);
    gun.rotation.y = Math.PI / 2;
    enableShadows(gun);
    model.add(gun);
    this.gun = gun;
  }

  reset(spawnPosition) {
    this.health = this.maxHealth;
    this.isDead = false;
    this._shootCooldown = this._randomCooldown();
    if (this.model) {
      this.model.position.set(spawnPosition.x, this.model.position.y, spawnPosition.z);
      this.model.rotation.set(0, 0, 0);
    }
  }

  _randomCooldown() {
    return 1.1 + Math.random() * 0.8;
  }

  _randomStrafeInterval() {
    return 1.5 + Math.random() * 1.5;
  }

  update(delta, playerPosition) {
    if (!this.model || this.isDead) {
      if (this.isDead && this.model) {
        this.model.rotation.x = THREE.MathUtils.lerp(this.model.rotation.x, Math.PI / 2, delta * 4);
      }
      return;
    }

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

    pos.x = clamp(pos.x + moveX * SPEED * delta, this.bounds.minX, this.bounds.maxX);
    pos.z = clamp(pos.z + moveZ * SPEED * delta, this.bounds.minZ, this.bounds.maxZ);

    this._shootCooldown -= delta;
    this._pendingShot = null;
    if (this._shootCooldown <= 0 && dist <= MAX_SHOOT_RANGE) {
      this._shootCooldown = this._randomCooldown();
      const hit = Math.random() < HIT_CHANCE;
      const damage = hit ? Math.round(DAMAGE_MIN + Math.random() * (DAMAGE_MAX - DAMAGE_MIN)) : 0;
      this._pendingShot = { hit, damage };
    }
  }

  // Returns { hit, damage } the frame a shot fires, otherwise null.
  consumeShot() {
    const shot = this._pendingShot;
    this._pendingShot = null;
    return shot;
  }

  getMuzzleWorldPosition(target = new THREE.Vector3()) {
    if (!this.gun) return target.copy(this.model.position);
    this.gun.getWorldPosition(target);
    return target;
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) this.isDead = true;
    return this.health;
  }

  get position() {
    return this.model.position;
  }
}
