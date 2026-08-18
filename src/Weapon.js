import { ASSETS } from './AssetLoader.js';
import { normalizeScale, enableShadows } from './utils.js';

// Every gun's longest raw-mesh axis runs along local X (confirmed by
// checking each model's accessor bounds), origin near the grip, muzzle
// toward -X. Yawing -90 degrees points that muzzle down the character's
// own forward axis (-Z) once the gun is parented to them.
const GUN_FORWARD_ROTATION_Y = -Math.PI / 2;

export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'PISTOL', icon: 'P', assetKey: 'pistol', scale: 0.32,
    damage: 12, magSize: 8, reserveMax: 24, fireCooldown: 0.22, pellets: 1, spread: 0,
  },
  smg: {
    id: 'smg', name: 'SMG', icon: 'SM', assetKey: 'smg', scale: 0.42,
    damage: 8, magSize: 25, reserveMax: 75, fireCooldown: 0.09, pellets: 1, spread: 0.035,
  },
  shotgun: {
    id: 'shotgun', name: 'SHOTGUN', icon: 'SG', assetKey: 'shotgun', scale: 0.55,
    damage: 7, magSize: 6, reserveMax: 18, fireCooldown: 0.7, pellets: 6, spread: 0.14,
  },
  sniper: {
    id: 'sniper', name: 'SNIPER', icon: 'SR', assetKey: 'sniper', scale: 0.7,
    damage: 55, magSize: 4, reserveMax: 12, fireCooldown: 1.15, pellets: 1, spread: 0,
  },
  ak: {
    id: 'ak', name: 'AK-47', icon: 'AK', assetKey: 'ak', scale: 0.5,
    damage: 14, magSize: 30, reserveMax: 90, fireCooldown: 0.12, pellets: 1, spread: 0.02,
  },
};

// Attaches a weapon model to a character group at an approximate hand
// position. Returns the gun object plus its resting local Z (for recoil).
export async function attachWeaponModel(assetLoader, characterGroup, characterHeight, weaponDef) {
  const gun = await assetLoader.load(ASSETS.guns[weaponDef.assetKey]);
  normalizeScale(gun, weaponDef.scale);
  gun.rotation.y = GUN_FORWARD_ROTATION_Y;
  gun.position.set(0.32, characterHeight * 0.56, 0.14);
  enableShadows(gun);
  characterGroup.add(gun);
  return gun;
}
