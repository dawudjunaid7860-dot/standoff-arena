const EXPLOSIVE_KEYS = new Set(['explodingBarrel', 'gasCan', 'gasTank']);
const MINE_KEY = 'landmine';

export const EXPLOSION_RADIUS = 6;
export const EXPLOSION_DAMAGE = 45;
export const MINE_TRIGGER_RADIUS = 1.4;
export const MINE_DAMAGE = 40;

export function isExplosiveKey(key) {
  return EXPLOSIVE_KEYS.has(key);
}

export function isMineKey(key) {
  return key === MINE_KEY;
}

// Tracks the map's shoot-to-explode props (barrels/gas cans/tanks) and
// step-to-explode mines so Game.js can check raycasts and positions against
// them without Arena needing to know anything about explosions.
export class Hazards {
  constructor() {
    this.explosives = [];
    this.mines = [];
  }

  registerExplosive(model, position) {
    this.explosives.push({ model, position: position.clone(), consumed: false });
  }

  registerMine(model, position) {
    this.mines.push({ model, position: position.clone(), consumed: false });
  }

  get explosiveModels() {
    return this.explosives.filter((e) => !e.consumed).map((e) => e.model);
  }

  // Walks up from a raycast hit's object to see if it belongs to a tracked,
  // still-active explosive; returns that entry or null.
  findExplosiveForObject(object) {
    for (const entry of this.explosives) {
      if (entry.consumed) continue;
      let o = object;
      while (o) {
        if (o === entry.model) return entry;
        o = o.parent;
      }
    }
    return null;
  }

  // Returns any active mines within trigger range of a position.
  checkMineProximity(position) {
    return this.mines.filter((m) => !m.consumed && m.position.distanceTo(position) < MINE_TRIGGER_RADIUS);
  }

  consume(entry) {
    entry.consumed = true;
    entry.model.visible = false;
  }
}
