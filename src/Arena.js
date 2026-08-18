import * as THREE from 'three';
import { ASSETS } from './AssetLoader.js';
import { normalizeScale, placeOnGround, enableShadows } from './utils.js';

const ARENA_HALF = 15;
const WALL_HEIGHT = 4;
const WALL_THICKNESS = 1;
const MOVEMENT_INSET = 1.5;

// Fixed decorative prop layout: [assetKey, x, z, targetSize, rotationY]
const DECOR_LAYOUT = [
  ['crate', -6, -4, 1.4, 0.4],
  ['crate', 6, 4, 1.4, -0.6],
  ['containerSmall', -9, 6, 1.8, 0.3],
  ['containerSmall', 9, -6, 1.8, 1.1],
  ['barrierLarge', -11, 0, 2.4, Math.PI / 2],
  ['barrierLarge', 11, 0, 2.4, Math.PI / 2],
  ['cardboardBoxes1', 4, -9, 1.0, 0.2],
  ['cardboardBoxes2', -4, 9, 1.0, -0.4],
  ['trafficCone', 2, 2, 0.7, 0],
  ['trafficCone', -2, -3, 0.7, 0],
  ['streetLight', -12, -12, 4.5, 0],
  ['streetLight', 12, 12, 4.5, Math.PI],
  ['woodPlanks', 0, 0, 1.3, 0.3],
];

export class Arena {
  constructor(scene, assetLoader) {
    this.scene = scene;
    this.assetLoader = assetLoader;
    this.bounds = {
      minX: -ARENA_HALF + MOVEMENT_INSET,
      maxX: ARENA_HALF - MOVEMENT_INSET,
      minZ: -ARENA_HALF + MOVEMENT_INSET,
      maxZ: ARENA_HALF - MOVEMENT_INSET,
    };
  }

  async build() {
    this._addLighting();
    this._addGround();
    this._addWalls();
    await this._addDecor();
  }

  _addLighting() {
    const hemi = new THREE.HemisphereLight(0x9fc7ff, 0x2b2f33, 1.1);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d9, 1.6);
    sun.position.set(18, 26, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -ARENA_HALF - 5;
    sun.shadow.camera.right = ARENA_HALF + 5;
    sun.shadow.camera.top = ARENA_HALF + 5;
    sun.shadow.camera.bottom = -ARENA_HALF - 5;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    this.scene.add(sun);

    this.scene.background = new THREE.Color(0x87a6c2);
    this.scene.fog = new THREE.Fog(0x87a6c2, 25, 60);
  }

  _addGround() {
    const geo = new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5b5f63, roughness: 0.95 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _addWalls() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x2e3236, roughness: 0.8 });
    const span = ARENA_HALF * 2 + WALL_THICKNESS * 2;
    const offset = ARENA_HALF + WALL_THICKNESS / 2;

    const north = new THREE.Mesh(new THREE.BoxGeometry(span, WALL_HEIGHT, WALL_THICKNESS), mat);
    north.position.set(0, WALL_HEIGHT / 2, -offset);

    const south = north.clone();
    south.position.z = offset;

    const east = new THREE.Mesh(new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, span), mat);
    east.position.set(offset, WALL_HEIGHT / 2, 0);

    const west = east.clone();
    west.position.x = -offset;

    for (const wall of [north, south, east, west]) {
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
    }
  }

  async _addDecor() {
    await Promise.all(
      DECOR_LAYOUT.map(async ([key, x, z, size, rotY]) => {
        const model = await this.assetLoader.load(ASSETS.environment[key]);
        normalizeScale(model, size);
        placeOnGround(model, x, z);
        model.rotation.y = rotY;
        enableShadows(model);
        this.scene.add(model);
      })
    );
  }
}
