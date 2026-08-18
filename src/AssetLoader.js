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
    containerLong: '/assets/Environment/glTF/Container_Long.gltf',
    barrierLarge: '/assets/Environment/glTF/Barrier_Large.gltf',
    barrierSingle: '/assets/Environment/glTF/Barrier_Single.gltf',
    cardboardBoxes1: '/assets/Environment/glTF/CardboardBoxes_1.gltf',
    cardboardBoxes2: '/assets/Environment/glTF/CardboardBoxes_2.gltf',
    cardboardBoxes3: '/assets/Environment/glTF/CardboardBoxes_3.gltf',
    trafficCone: '/assets/Environment/glTF/TrafficCone.gltf',
    streetLight: '/assets/Environment/glTF/StreetLight.gltf',
    woodPlanks: '/assets/Environment/glTF/WoodPlanks.gltf',
    structure1: '/assets/Environment/glTF/Structure_1.gltf',
    structure2: '/assets/Environment/glTF/Structure_2.gltf',
    structure3: '/assets/Environment/glTF/Structure_3.gltf',
    structure4: '/assets/Environment/glTF/Structure_4.gltf',
    waterTankPlatform: '/assets/Environment/glTF/WaterTank_Platform.gltf',
    trashContainer: '/assets/Environment/glTF/TrashContainer.gltf',
    pallet: '/assets/Environment/glTF/Pallet.gltf',
    palletBroken: '/assets/Environment/glTF/Pallet_Broken.gltf',
    debrisTires: '/assets/Environment/glTF/Debris_Tires.gltf',
    debrisPapers1: '/assets/Environment/glTF/Debris_Papers_1.gltf',
    gasCan: '/assets/Environment/glTF/GasCan.gltf',
    gasTank: '/assets/Environment/glTF/GasTank.gltf',
    explodingBarrel: '/assets/Environment/glTF/ExplodingBarrel.gltf',
    sign: '/assets/Environment/glTF/Sign.gltf',
    fence: '/assets/Environment/glTF/Fence.gltf',
    fenceLong: '/assets/Environment/glTF/Fence_Long.gltf',
    pipes: '/assets/Environment/glTF/Pipes.gltf',
    tree1: '/assets/Environment/glTF/Tree_1.gltf',
    tree2: '/assets/Environment/glTF/Tree_2.gltf',
    tree3: '/assets/Environment/glTF/Tree_3.gltf',
    tank: '/assets/Environment/glTF/Tank.gltf',
  },
};
