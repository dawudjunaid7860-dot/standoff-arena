import * as THREE from 'three';

// Axis-aligned box collider on the XZ plane, built from an object's actual
// world-space bounding box so it stays correct regardless of the model's
// native scale/pivot.
export function buildBoxCollider(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  return { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
}

// Pushes a circle (x, z, radius) out of any overlapping box colliders.
// Simple closest-point resolution, good enough for character-vs-scenery
// at this scale (not a full physics engine).
export function resolveCollisions(x, z, radius, colliders) {
  for (const c of colliders) {
    const closestX = Math.min(Math.max(x, c.minX), c.maxX);
    const closestZ = Math.min(Math.max(z, c.minZ), c.maxZ);
    const dx = x - closestX;
    const dz = z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const push = radius - dist;
        x += (dx / dist) * push;
        z += (dz / dist) * push;
      } else {
        const overlapLeft = x - c.minX;
        const overlapRight = c.maxX - x;
        const overlapTop = z - c.minZ;
        const overlapBottom = c.maxZ - z;
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        if (minOverlap === overlapLeft) x = c.minX - radius;
        else if (minOverlap === overlapRight) x = c.maxX + radius;
        else if (minOverlap === overlapTop) z = c.minZ - radius;
        else z = c.maxZ + radius;
      }
    }
  }
  return { x, z };
}
