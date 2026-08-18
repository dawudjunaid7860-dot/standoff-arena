import * as THREE from 'three';
import { ASSETS } from './AssetLoader.js';
import { normalizeScale, placeOnGround, enableShadows, mulberry32 } from './utils.js';
import { buildBoxCollider } from './Collision.js';

const ARENA_HALF = 34;
const WALL_HEIGHT = 5;
const WALL_THICKNESS = 1;
const MOVEMENT_INSET = 2.5;
const LAYOUT_SEED = 1337;

const BUILDING_KEYS = ['structure1', 'structure2', 'structure3', 'structure4', 'containerLong', 'waterTankPlatform'];
const MID_COVER_KEYS = [
  'crate', 'containerSmall', 'barrierLarge', 'barrierSingle',
  'cardboardBoxes1', 'cardboardBoxes2', 'cardboardBoxes3',
  'trashContainer', 'pallet', 'palletBroken', 'gasTank', 'explodingBarrel',
];
const CLUTTER_KEYS = [
  'trafficCone', 'woodPlanks', 'debrisTires', 'debrisPapers1', 'gasCan',
  'sign', 'pipes', 'tree1', 'tree2', 'tree3', 'fence', 'fenceLong',
];

export class Arena {
  constructor(scene, assetLoader) {
    this.scene = scene;
    this.assetLoader = assetLoader;
    this.colliders = [];
    // Solid meshes that block bullets as well as movement (walls + large
    // cover), used for line-of-sight raycasts so shots can't pass through cover.
    this.obstacleModels = [];
    this.bounds = {
      minX: -ARENA_HALF + MOVEMENT_INSET,
      maxX: ARENA_HALF - MOVEMENT_INSET,
      minZ: -ARENA_HALF + MOVEMENT_INSET,
      maxZ: ARENA_HALF - MOVEMENT_INSET,
    };
  }

  async build(spawnZones) {
    this._addLighting();
    this._addGround();
    this._addWalls();
    await this._scatterProps(spawnZones);
  }

  _addLighting() {
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a3f2e, 1.15);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d9, 1.7);
    sun.position.set(30, 45, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -ARENA_HALF - 5;
    sun.shadow.camera.right = ARENA_HALF + 5;
    sun.shadow.camera.top = ARENA_HALF + 5;
    sun.shadow.camera.bottom = -ARENA_HALF - 5;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 100;
    this.scene.add(sun);

    this.scene.background = new THREE.Color(0xaed4f0);
    this.scene.fog = new THREE.Fog(0xaed4f0, 55, 110);
  }

  _addGround() {
    const geo = new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xcfab68, roughness: 0.95 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _addWalls() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x33302a, roughness: 0.8 });
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
      wall.updateMatrixWorld(true);
      this.colliders.push(buildBoxCollider(wall));
      this.obstacleModels.push(wall);
    }
  }

  // Rejection-samples positions inside the arena, keeping cover away from
  // spawn points and from each other, using a fixed seed so the layout is
  // stable across reloads instead of reshuffling every time.
  async _scatterProps(spawnZones) {
    const rng = mulberry32(LAYOUT_SEED);
    const placedSpots = [];
    const jobs = [];

    const tryFindSpot = (halfExtent, minSeparation, avoidZones) => {
      for (let attempt = 0; attempt < 30; attempt++) {
        const x = (rng() * 2 - 1) * halfExtent;
        const z = (rng() * 2 - 1) * halfExtent;
        let ok = true;
        for (const zone of avoidZones) {
          if (Math.hypot(x - zone.x, z - zone.z) < zone.r) { ok = false; break; }
        }
        if (ok) {
          for (const spot of placedSpots) {
            if (Math.hypot(x - spot.x, z - spot.z) < Math.max(minSeparation, spot.r + minSeparation)) { ok = false; break; }
          }
        }
        if (ok) return { x, z };
      }
      return null;
    };

    const spawnAvoidance = spawnZones.map((p) => ({ x: p.x, z: p.z, r: 9 }));

    // Buildings: ringed around the mid-field for sightline-blocking cover.
    const buildingCount = 7;
    for (let i = 0; i < buildingCount; i++) {
      const angle = (i / buildingCount) * Math.PI * 2 + (rng() - 0.5) * 0.5;
      const radius = 14 + rng() * 12;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const tooCloseToSpawn = spawnAvoidance.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.r);
      if (tooCloseToSpawn) continue;

      const key = BUILDING_KEYS[Math.floor(rng() * BUILDING_KEYS.length)];
      const size = 6 + rng() * 3.5;
      placedSpots.push({ x, z, r: size * 0.5 });
      jobs.push({ key, x, z, size, rotY: rng() * Math.PI * 2, collides: true });
    }

    // Mid-sized cover, scattered through the rest of the arena.
    for (let i = 0; i < 22; i++) {
      const spot = tryFindSpot(ARENA_HALF - 4, 4.5, spawnAvoidance);
      if (!spot) continue;
      const key = MID_COVER_KEYS[Math.floor(rng() * MID_COVER_KEYS.length)];
      const size = 1.3 + rng() * 1.1;
      placedSpots.push({ x: spot.x, z: spot.z, r: size * 0.6 });
      jobs.push({ key, x: spot.x, z: spot.z, size, rotY: rng() * Math.PI * 2, collides: true });
    }

    // Small non-blocking clutter for visual density.
    const looseAvoidance = spawnZones.map((p) => ({ x: p.x, z: p.z, r: 5 }));
    for (let i = 0; i < 20; i++) {
      const spot = tryFindSpot(ARENA_HALF - 2, 2, looseAvoidance);
      if (!spot) continue;
      const key = CLUTTER_KEYS[Math.floor(rng() * CLUTTER_KEYS.length)];
      const size = key === 'streetLight' ? 4.5 : 0.6 + rng() * 0.8;
      placedSpots.push({ x: spot.x, z: spot.z, r: size * 0.4 });
      jobs.push({ key, x: spot.x, z: spot.z, size, rotY: rng() * Math.PI * 2, collides: false });
    }

    await Promise.all(
      jobs.map(async (job) => {
        const model = await this.assetLoader.load(ASSETS.environment[job.key]);
        normalizeScale(model, job.size);
        placeOnGround(model, job.x, job.z);
        model.rotation.y = job.rotY;
        enableShadows(model);
        this.scene.add(model);
        if (job.collides) {
          this.colliders.push(buildBoxCollider(model));
          this.obstacleModels.push(model);
        }
      })
    );
  }
}
