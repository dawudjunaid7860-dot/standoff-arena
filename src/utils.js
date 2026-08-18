import * as THREE from 'three';

// Kenney's raw model units don't map to real-world meters consistently, so
// instead of hand-picking scale factors per model, we measure the loaded
// model's own bounding box and scale it so its largest dimension matches
// the size we actually want in the arena.
export function normalizeScale(object, targetMaxDimension) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const largest = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetMaxDimension / largest;
  object.scale.setScalar(scale);
  return scale;
}

// Sits an object on the ground plane (y = 0) at the given x/z, regardless of
// where the model's own origin is relative to its feet/base.
export function placeOnGround(object, x, z) {
  object.position.set(x, 0, z);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  object.position.y -= box.min.y;
}

export function enableShadows(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
