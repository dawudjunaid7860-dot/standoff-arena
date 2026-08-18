import * as THREE from 'three';
import { ASSETS } from './AssetLoader.js';
import { normalizeScale, placeOnGround, enableShadows } from './utils.js';
import { WEAPONS } from './Weapon.js';

const PICKUP_RADIUS = 1.6;
const RESPAWN_TIME = 25;
const BOB_SPEED = 2.2;
const BOB_HEIGHT = 0.15;
const SPIN_SPEED = 1.2;

// Fixed, hand-placed so they land in sensible open spots regardless of what
// the arena's randomized cover scatter did around them.
const LAYOUT = [
  { weaponId: 'smg', x: -14, z: 6 },
  { weaponId: 'shotgun', x: 14, z: -6 },
  { weaponId: 'sniper', x: 0, z: 0 },
  { weaponId: 'ak', x: 10, z: 12 },
];

// Exposed so Arena's random cover scatter can steer clear of pickup spots.
export const PICKUP_POSITIONS = LAYOUT.map(({ x, z }) => ({ x, z }));

export class WeaponPickups {
  constructor(scene) {
    this.scene = scene;
    this.pickups = [];
  }

  async load(assetLoader) {
    await Promise.all(
      LAYOUT.map(async ({ weaponId, x, z }) => {
        const def = WEAPONS[weaponId];
        const model = await assetLoader.load(ASSETS.guns[def.assetKey]);
        normalizeScale(model, def.scale * 1.6);
        placeOnGround(model, x, z);
        model.position.y += 0.9;
        enableShadows(model);
        this.scene.add(model);
        this.pickups.push({
          weaponId,
          model,
          basePosition: new THREE.Vector3(x, model.position.y, z),
          active: true,
          respawnTimer: 0,
        });
      })
    );
  }

  update(delta, player, onPickup) {
    for (const pickup of this.pickups) {
      if (!pickup.active) {
        pickup.respawnTimer -= delta;
        if (pickup.respawnTimer <= 0) {
          pickup.active = true;
          pickup.model.visible = true;
        }
        continue;
      }

      pickup.model.rotation.y += SPIN_SPEED * delta;
      pickup.model.position.y = pickup.basePosition.y + Math.sin(performance.now() * 0.001 * BOB_SPEED) * BOB_HEIGHT;

      if (!player.isDown && player.position.distanceTo(pickup.basePosition) < PICKUP_RADIUS) {
        pickup.active = false;
        pickup.model.visible = false;
        pickup.respawnTimer = RESPAWN_TIME;
        onPickup(WEAPONS[pickup.weaponId]);
      }
    }
  }
}
