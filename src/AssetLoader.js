import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Loads each glTF once and hands out clones, so multiple instances of the
// same model (e.g. the pistol held by both the player and the enemy) don't
// each trigger their own network fetch + parse.
export class AssetLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  load(url) {
    if (!this.cache.has(url)) {
      const promise = new Promise((resolve, reject) => {
        this.loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
      });
      this.cache.set(url, promise);
    }
    return this.cache.get(url).then((original) => original.clone(true));
  }
}

export const ASSETS = {
  characters: {
    enemy: '/assets/Characters/glTF/Character_Enemy.gltf',
    soldier: '/assets/Characters/glTF/Character_Soldier.gltf',
  },
  guns: {
    pistol: '/assets/Guns/glTF/Pistol.gltf',
  },
  environment: {
    crate: '/assets/Environment/glTF/Crate.gltf',
    containerSmall: '/assets/Environment/glTF/Container_Small.gltf',
    barrierLarge: '/assets/Environment/glTF/Barrier_Large.gltf',
    cardboardBoxes1: '/assets/Environment/glTF/CardboardBoxes_1.gltf',
    cardboardBoxes2: '/assets/Environment/glTF/CardboardBoxes_2.gltf',
    trafficCone: '/assets/Environment/glTF/TrafficCone.gltf',
    streetLight: '/assets/Environment/glTF/StreetLight.gltf',
    woodPlanks: '/assets/Environment/glTF/WoodPlanks.gltf',
  },
};
