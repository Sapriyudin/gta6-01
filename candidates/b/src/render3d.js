// The 3D renderer: a three.js scene of Solmar City — sun, sky, roads, buildings, parks, beach —
// with a third-person chase camera behind the player. Entity meshes are pooled: one mesh per car,
// person and pickup, created on demand and reused while the entity lives.

import * as THREE from 'three';
import { VIEW, WORLD, PALETTE, ROAD_W, BEACH_Z, WATER_Z } from './config.js';
import { ROAD_XS as RX, ROAD_ZS as RZ } from './city.js';
import { missionMarker } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WIN = 'win';

const SKY = 0x8ec3e0;

// The physics world is 3200x2400 units (a car is 4.4 long, a road 96 wide), which reads as a
// miniature from a chase camera. The renderer scales every XZ position by S so the city reads
// at real proportions: roads ~12 wide, cars ~4.4 long, people ~2.5 tall. Heights (building
// heights, bullet height, mesh sizes) are already authored at that scale.
const S = 1 / 8;
const px = (v) => v * S;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(VIEW.width, VIEW.height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 30, 95);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5d7a4a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(7.5, 11, 3.75);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 35;
  scene.add(sun);
  scene.add(sun.target);

  const camera = new THREE.PerspectiveCamera(58, VIEW.width / VIEW.height, 0.5, 120);

  // ---- static city ----
  const mats = new Map();
  function mat(color) {
    if (!mats.has(color)) mats.set(color, new THREE.MeshLambertMaterial({ color }));
    return mats.get(color);
  }
  function box(w, h, d, color, x, y, z, shadow = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  function buildStatic(city) {
    // Ground, beach, sea.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(px(WORLD.width), px(WORLD.height)), mat(PALETTE.grass));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(px(WORLD.width) / 2, 0, px(WORLD.height) / 2);
    ground.receiveShadow = true;
    scene.add(ground);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(px(WORLD.width), px(WORLD.height - BEACH_Z)), mat(PALETTE.sand));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(px(WORLD.width) / 2, 0.02, px((BEACH_Z + WORLD.height) / 2));
    sand.receiveShadow = true;
    scene.add(sand);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(px(WORLD.width), px(WORLD.height - WATER_Z)), mat(PALETTE.water));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(px(WORLD.width) / 2, 0.05, px((WATER_Z + WORLD.height) / 2));
    scene.add(sea);
    // Roads: asphalt strips with sidewalk borders and centre dashes.
    for (const rx of RX) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(px(ROAD_W + 4), px(BEACH_Z)), mat(PALETTE.sidewalk));
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(px(rx), 0.04, px(BEACH_Z) / 2);
      walk.receiveShadow = true;
      scene.add(walk);
      const road = new THREE.Mesh(new THREE.PlaneGeometry(px(ROAD_W), px(BEACH_Z)), mat(PALETTE.road));
      road.rotation.x = -Math.PI / 2;
      road.position.set(px(rx), 0.06, px(BEACH_Z) / 2);
      road.receiveShadow = true;
      scene.add(road);
      for (let z = 1; z < px(BEACH_Z); z += 2) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 1), mat(PALETTE.lane));
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(px(rx), 0.08, z);
        scene.add(dash);
      }
    }
    for (const rz of RZ) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(px(WORLD.width), px(ROAD_W + 4)), mat(PALETTE.sidewalk));
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(px(WORLD.width) / 2, 0.04, px(rz));
      walk.receiveShadow = true;
      scene.add(walk);
      const road = new THREE.Mesh(new THREE.PlaneGeometry(px(WORLD.width), px(ROAD_W)), mat(PALETTE.road));
      road.rotation.x = -Math.PI / 2;
      road.position.set(px(WORLD.width) / 2, 0.06, px(rz));
      road.receiveShadow = true;
      scene.add(road);
      for (let x = 1; x < px(WORLD.width); x += 2) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.35), mat(PALETTE.lane));
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.08, px(rz));
        scene.add(dash);
      }
    }
    // Parks with trees, and the plaza.
    for (const park of city.parks) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(px(park.w), px(park.h)), mat(PALETTE.park));
      g.rotation.x = -Math.PI / 2;
      g.position.set(px(park.x + park.w / 2), 0.07, px(park.z + park.h / 2));
      g.receiveShadow = true;
      scene.add(g);
      for (let i = 0; i < 7; i += 1) {
        const tx = park.x + 8 + ((i * 37) % Math.max(10, park.w - 16));
        const tz = park.z + 8 + ((i * 61) % Math.max(10, park.h - 16));
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.4, 6), mat(0x7a5230));
        trunk.position.set(px(tx), 1.2, px(tz));
        trunk.castShadow = true;
        scene.add(trunk);
        const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.5, 8), mat(0x3f7a2e));
        top.position.set(px(tx), 4.4, px(tz));
        top.castShadow = true;
        scene.add(top);
      }
    }
    for (const plaza of city.plazas) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(px(plaza.w), px(plaza.h)), mat(PALETTE.plaza));
      g.rotation.x = -Math.PI / 2;
      g.position.set(px(plaza.x + plaza.w / 2), 0.07, px(plaza.z + plaza.h / 2));
      g.receiveShadow = true;
      scene.add(g);
    }
    // Buildings: a box per building, roof slab on top, windows as a darker band.
    for (const b of city.buildings) {
      const h = b.height * 0.6;
      box(px(b.w), h, px(b.h), PALETTE.wall, px(b.x + b.w / 2), h / 2, px(b.z + b.h / 2));
      box(px(b.w) + 0.2, 0.5, px(b.h) + 0.2, b.roof, px(b.x + b.w / 2), h + 0.25, px(b.z + b.h / 2));
      if (h > 8) {
        // Glass bands on three faces so the building reads from any approach.
        const bandZ = new THREE.Mesh(new THREE.BoxGeometry(px(b.w) * 0.8, h * 0.5, 0.15), mat(PALETTE.glass));
        bandZ.position.set(px(b.x + b.w / 2), h * 0.55, px(b.z + b.h) - 0.05);
        scene.add(bandZ);
        const bandZ2 = new THREE.Mesh(new THREE.BoxGeometry(px(b.w) * 0.8, h * 0.5, 0.15), mat(PALETTE.glass));
        bandZ2.position.set(px(b.x + b.w / 2), h * 0.55, px(b.z) + 0.05);
        scene.add(bandZ2);
        const bandX = new THREE.Mesh(new THREE.BoxGeometry(0.15, h * 0.5, px(b.h) * 0.8), mat(PALETTE.glass));
        bandX.position.set(px(b.x) + 0.05, h * 0.55, px(b.z + b.h / 2));
        scene.add(bandX);
      }
    }
  }

  // ---- entity meshes (pooled) ----
  const carMeshes = new Map();
  const pedMeshes = new Map();
  const copMeshes = new Map();
  const rivalMeshes = new Map();
  let playerMesh = null;
  const pickupMeshes = new Map();
  const bulletMeshes = [];
  let markerMesh = null;
  let markerRing = null;

  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc4d8 });

  function makeCarMesh(color, isCop) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, 2.2), new THREE.MeshLambertMaterial({ color }));
    body.position.y = 0.85;
    body.castShadow = true;
    g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.9), glassMat);
    cabin.position.set(-0.3, 1.75, 0);
    cabin.castShadow = true;
    g.add(cabin);
    for (const [wx, wz] of [[1.5, 1.05], [1.5, -1.05], [-1.5, 1.05], [-1.5, -1.05]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 0.55, wz);
      g.add(w);
    }
    if (isCop) {
      const barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.6), new THREE.MeshLambertMaterial({ color: 0xff4d4d }));
      barR.position.set(-0.3, 2.3, 0.5);
      g.add(barR);
      const barB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.6), new THREE.MeshLambertMaterial({ color: 0x4d8dff }));
      barB.position.set(-0.3, 2.3, -0.5);
      g.add(barB);
    }
    return g;
  }

  function makePersonMesh(shirt, isPlayer) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.5, 10), new THREE.MeshLambertMaterial({ color: shirt }));
    body.position.y = 1.05;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), new THREE.MeshLambertMaterial({ color: 0xf2c89b }));
    head.position.y = 2.15;
    head.castShadow = true;
    g.add(head);
    if (isPlayer) {
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.18), new THREE.MeshLambertMaterial({ color: 0x1c1f26 }));
      gun.position.set(0.7, 1.3, 0.35);
      g.add(gun);
    }
    return g;
  }

  function makePickupMesh(kind) {
    const color = kind === 'health' ? 0xff5d5d : kind === 'armor' ? 0x5d8fe8 : kind === 'ammo' ? 0xffd21a : 0x37d67a;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 }));
    m.castShadow = true;
    return m;
  }

  let staticBuilt = false;
  function ensureStatic(state) {
    if (staticBuilt) return;
    buildStatic(state.city);
    staticBuilt = true;
  }

  function syncCars(state) {
    const seen = new Set();
    for (const car of state.cars) {
      seen.add(car);
      let mesh = carMeshes.get(car);
      if (!mesh) {
        mesh = makeCarMesh(car.color, car.driver === 'cop');
        carMeshes.set(car, mesh);
        scene.add(mesh);
      }
      mesh.position.set(px(car.x), 0, px(car.z));
      mesh.rotation.y = -car.angle;
      if (car.wrecked) {
        mesh.rotation.z = 0.12;
        if (!mesh.userData.wrecked) {
          mesh.userData.wrecked = true;
          mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0x2c2c30 });
        }
      } else {
        mesh.rotation.z = 0;
      }
    }
    for (const [car, mesh] of carMeshes) {
      if (!seen.has(car)) { scene.remove(mesh); carMeshes.delete(car); }
    }
  }

  function syncPerson(map, list, shirtOf, isPlayer) {
    const seen = new Set();
    for (const e of list) {
      if (e.state === 'down' && e.health !== undefined && e.health <= 0) continue;
      seen.add(e);
      let mesh = map.get(e);
      if (!mesh) {
        mesh = makePersonMesh(shirtOf(e), isPlayer);
        map.set(e, mesh);
        scene.add(mesh);
      }
      mesh.position.set(px(e.x), 0, px(e.z));
      mesh.rotation.y = -e.angle;
      if (e.state === 'down') {
        mesh.rotation.x = Math.PI / 2;
        mesh.position.y = 0.4;
      } else {
        mesh.rotation.x = 0;
        mesh.position.y = 0;
      }
    }
    for (const [e, mesh] of map) {
      if (!seen.has(e)) { scene.remove(mesh); map.delete(e); }
    }
  }

  function syncPickups(state) {
    const seen = new Set();
    for (const pk of state.pickups) {
      seen.add(pk);
      let mesh = pickupMeshes.get(pk);
      if (!mesh) {
        mesh = makePickupMesh(pk.kind);
        pickupMeshes.set(pk, mesh);
        scene.add(mesh);
      }
      mesh.position.set(px(pk.x), 1.2 + Math.sin(pk.bob * 3) * 0.25, px(pk.z));
      mesh.rotation.y = state.time * 1.5;
    }
    for (const [pk, mesh] of pickupMeshes) {
      if (!seen.has(pk)) { scene.remove(mesh); pickupMeshes.delete(pk); }
    }
  }

  function syncBullets(state) {
    while (bulletMeshes.length < state.bullets.length) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), new THREE.MeshLambertMaterial({ color: 0xffe27a, emissive: 0xffe27a, emissiveIntensity: 0.8 }));
      bulletMeshes.push(m);
      scene.add(m);
    }
    state.bullets.forEach((b, i) => {
      const m = bulletMeshes[i];
      m.visible = true;
      m.position.set(px(b.x), b.y, px(b.z));
      m.rotation.y = -Math.atan2(b.vz, b.vx);
    });
    for (let i = state.bullets.length; i < bulletMeshes.length; i += 1) bulletMeshes[i].visible = false;
  }

  function syncMarker(state) {
    const m = missionMarker(state);
    if (!m) {
      if (markerMesh) markerMesh.visible = false;
      if (markerRing) markerRing.visible = false;
      return;
    }
    if (!markerMesh) {
      markerMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 4, 10),
        new THREE.MeshLambertMaterial({ color: 0xffd21a, transparent: true, opacity: 0.35, emissive: 0xffd21a, emissiveIntensity: 0.4 }),
      );
      scene.add(markerMesh);
      markerRing = new THREE.Mesh(
        new THREE.RingGeometry(2.2, 3, 24),
        new THREE.MeshLambertMaterial({ color: 0xffd21a, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
      );
      markerRing.rotation.x = -Math.PI / 2;
      scene.add(markerRing);
    }
    markerMesh.visible = true;
    markerRing.visible = true;
    markerMesh.position.set(px(m.x), 2, px(m.z));
    const pulse = 1 + 0.15 * Math.sin(state.time * 4);
    markerRing.position.set(px(m.x), 0.15, px(m.z));
    markerRing.scale.set(pulse, pulse, 1);
  }

  function draw(state, screen) {
    ensureStatic(state);
    syncCars(state);
    syncPerson(pedMeshes, state.peds, (e) => e.shirt, false);
    syncPerson(copMeshes, state.cops.filter((c) => !c.inCar), () => 0x1d3a6e, false);
    syncPerson(rivalMeshes, state.rivals, () => 0x8a2f2f, false);
    // The player on foot.
    const p = state.player;
    if (!p.inCar && !playerMesh) {
      playerMesh = makePersonMesh(0x0e7490, true);
      scene.add(playerMesh);
    }
    if (playerMesh) {
      playerMesh.visible = !p.inCar;
      playerMesh.position.set(px(p.x), 0, px(p.z));
      playerMesh.rotation.y = -p.angle;
      if (p.invuln > 0 && Math.floor(state.time * 14) % 2 === 0) playerMesh.visible = false;
      else if (!p.inCar) playerMesh.visible = true;
    }
    syncPickups(state);
    syncBullets(state);
    syncMarker(state);

    // Camera: third person behind the heading; title orbits the city centre.
    if (screen === SCREEN_TITLE) {
      const t = state.time * 0.08;
      camera.position.set(px(1600) + Math.cos(t) * 22, 11, px(1100) + Math.sin(t) * 16);
      camera.lookAt(px(1600), 0, px(1100));
    } else {
      const cam = state.camera;
      const dist = p.inCar ? 18 : 12;
      const height = p.inCar ? 14 : 7;
      const fx = Math.cos(cam.angle), fz = Math.sin(cam.angle);
      // A small lateral offset keeps the player's car visible beside a cop that is ramming it
      // from directly behind — otherwise the cop fills the frame and hides the player.
      const rx = -fz, rz = fx;
      const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
      const shakeZ = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
      camera.position.set(
        px(cam.x) - fx * dist + rx * 6 + shakeX,
        height,
        px(cam.z) - fz * dist + rz * 6 + shakeZ,
      );
      camera.lookAt(px(cam.x) + fx * 5, 1.6, px(cam.z) + fz * 5);
    }
    // The sun's shadow frustum follows the player.
    sun.position.set(px(p.x) + 7.5, 11, px(p.z) + 3.75);
    sun.target.position.set(px(p.x), 0, px(p.z));
    sun.target.updateMatrixWorld();

    renderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth || VIEW.width;
    const h = canvas.clientHeight || VIEW.height;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  return { draw, resize };
}
