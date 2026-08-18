import * as THREE from 'three';

const FLASH_DURATION = 0.18;
const KNOCKBACK_SPEED = 1.6;
const KNOCKBACK_DECAY = 9; // higher = settles faster

// Shared "got shot" feedback for any character model: a brief red emissive
// flash across all its materials plus a small velocity-impulse knockback
// that settles out on its own, without needing a separate visual transform
// layer (the impulse is small enough to be gameplay-negligible).
export class HitReaction {
  constructor(model) {
    this.model = model;
    this._flashTimer = 0;
    this._knockbackVelocity = new THREE.Vector3();
  }

  trigger(fromPosition, toPosition) {
    this._flashTimer = FLASH_DURATION;

    const dir = new THREE.Vector3(toPosition.x - fromPosition.x, 0, toPosition.z - fromPosition.z);
    if (dir.lengthSq() > 0.0001) dir.normalize();
    this._knockbackVelocity.copy(dir).multiplyScalar(KNOCKBACK_SPEED);
  }

  update(delta) {
    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - delta);
      const intensity = this._flashTimer / FLASH_DURATION;
      this.model.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of materials) {
          if (!mat.emissive) continue;
          mat.emissive.setHex(0xff2222);
          mat.emissiveIntensity = intensity;
        }
      });
    }

    if (this._knockbackVelocity.lengthSq() > 0.0001) {
      this.model.position.addScaledVector(this._knockbackVelocity, delta);
      this._knockbackVelocity.multiplyScalar(Math.max(0, 1 - delta * KNOCKBACK_DECAY));
    }
  }
}
