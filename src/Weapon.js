import { ASSETS } from './AssetLoader.js';
import { normalizeScale, enableShadows } from './utils.js';

export const MAG_SIZE = 8;
export const RESERVE_START = 24;
export const RELOAD_TIME = 1.3;
export const FIRE_COOLDOWN = 0.22;
export const DAMAGE = 12;

const GUN_SIZE = 0.32;
// The pistol model's longest axis (from the raw mesh bounds) runs along
// local X, with the origin sitting near the grip and the muzzle out toward
// -X. Yawing -90 degrees points that muzzle down the character's own
// forward axis (-Z) once the gun is parented to them.
const GUN_FORWARD_ROTATION_Y = -Math.PI / 2;

// Attaches a pistol to a character group at an approximate hand position.
// Returns the gun object plus its resting local Z (for recoil animation).
export async function attachPistol(assetLoader, characterGroup, characterHeight) {
  const gun = await assetLoader.load(ASSETS.guns.pistol);
  normalizeScale(gun, GUN_SIZE);
  gun.rotation.y = GUN_FORWARD_ROTATION_Y;
  gun.position.set(0.32, characterHeight * 0.56, 0.14);
  enableShadows(gun);
  characterGroup.add(gun);
  return gun;
}
