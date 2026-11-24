// Drawing the world in 3D: Neon Bay at night, rendered with Three.js.
// One job: turn the game state into a frame the player (and the judge)
// can read. The gameplay logic never changed — same x/y world, same cars,
// same people — only the camera moved: a chase camera behind the car on
// the road, a high over-shoulder camera on foot. The 2D HUD still draws
// on its own canvas on top of this one.
import * as THREE from 'three';
import { WORLD, VIEW, PALETTE, CAR, CAMERA3D, NEON } from './config.js';
import { CITY, NEON_SIGNS, ROAD_LINES, BEACH_TOP, WATER_TOP } from './city.js';
import { clamp, damp, makeRng, pick } from './random.js';
import { mouseNdc } from './input.js';
import { policeLightPhase } from './police.js';

const HALF = WORLD.size / 2;
// Game x/y (y south) map to three.js x/z (z south); the world is centred
// on the origin so the camera maths stay small.
const tx = (x) => x - HALF;
const tz = (y) => y - HALF;

let renderer = null;
let scene = null;
let threeCam = null;
let rendererOK = false;
const raycaster = new THREE.Raycaster();
const tmpV = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Camera state. makeCamera keeps the old {x, y, zoom} shape (the HUD used
// it as a virtual top-down origin) and adds the smoothed 3D position and
// look target in world coordinates.
// ---------------------------------------------------------------------------
export function makeCamera() {
  return {
    x: 0, y: 0, zoom: 1,
    _px: 0, _py: 120, _pz: 0, // camera position (world x, height, world y)
    _tx: 0, _ty: 0, _tz: 0, // look target
    _init: false,
  };
}

// Chase the player: behind the car while driving, higher and further back
// on foot so the street reads. Smoothed, so the view glides into turns.
export function updateCamera(camera, state, dt) {
  const player = state.player;
  const driving = !player.onFoot && player.car;
  const ang = player.angle;
  const fx = Math.cos(ang);
  const fy = Math.sin(ang);
  const dist = driving ? CAMERA3D.driveDist : CAMERA3D.footDist;
  const height = driving ? CAMERA3D.driveHeight : CAMERA3D.footHeight;
  const wantPx = player.x - fx * dist;
  const wantPy = height;
  const wantPz = player.y - fy * dist;
  const wantTx = player.x + fx * CAMERA3D.lookAhead;
  const wantTy = 8;
  const wantTz = player.y + fy * CAMERA3D.lookAhead;
  if (!camera._init) {
    camera._px = wantPx;
    camera._py = wantPy;
    camera._pz = wantPz;
    camera._tx = wantTx;
    camera._ty = wantTy;
    camera._tz = wantTz;
    camera._init = true;
  } else {
    camera._px = damp(camera._px, wantPx, CAMERA3D.smooth, dt);
    camera._py = damp(camera._py, wantPy, CAMERA3D.smooth, dt);
    camera._pz = damp(camera._pz, wantPz, CAMERA3D.smooth, dt);
    camera._tx = damp(camera._tx, wantTx, CAMERA3D.smooth, dt);
    camera._ty = damp(camera._ty, wantTy, CAMERA3D.smooth, dt);
    camera._tz = damp(camera._tz, wantTz, CAMERA3D.smooth, dt);
  }
  if (threeCam) {
    threeCam.position.set(tx(camera._px), camera._py, tz(camera._pz));
    threeCam.lookAt(tx(camera._tx), camera._ty, tz(camera._tz));
  }
  // Virtual top-down origin, kept for anything that still thinks in 2D.
  camera.x = clamp(player.x - VIEW.width / 2, 0, WORLD.size - VIEW.width);
  camera.y = clamp(player.y - VIEW.height / 2, 0, WORLD.size - VIEW.height);
}

// Where on the ground the mouse points, for aiming on foot. The mouse ray
// is unprojected through the chase camera and met with the street plane.
export function screenToGround() {
  if (!threeCam) return null;
  const ndc = mouseNdc(VIEW.width, VIEW.height);
  raycaster.setFromCamera(ndc, threeCam);
  const o = raycaster.ray.origin;
  const d = raycaster.ray.direction;
  if (d.y >= -0.001) return null;
  const t = -o.y / d.y;
  return { x: o.x + d.x * t + HALF, y: o.z + d.z * t + HALF };
}

// A world point as a screen point, or null when it is behind the camera.
// The HUD uses it for the off-screen mission arrow.
export function projectToScreen(x, y) {
  if (!threeCam) return null;
  tmpV.set(tx(x), 0, tz(y)).project(threeCam);
  if (tmpV.z > 1) return null;
  return { x: (tmpV.x + 1) / 2 * VIEW.width, y: (1 - tmpV.y) / 2 * VIEW.height };
}

// ---------------------------------------------------------------------------
// Canvas textures: lit windows, neon signs, the road with its dashes.
// ---------------------------------------------------------------------------
function makeWindowTexture(base, litColors, seed, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const rng = makeRng(seed);
  for (let y = 10; y < 244; y += 18) {
    for (let x = 10; x < 118; x += 16) {
      if (rng() < litRatio) {
        g.fillStyle = pick(rng, litColors);
        g.globalAlpha = 0.55 + rng() * 0.45;
      } else {
        g.fillStyle = '#07080d';
        g.globalAlpha = 1;
      }
      g.fillRect(x, y, 10, 12);
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSignTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(4,4,12,0.92)';
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.strokeRect(4, 4, 504, 120);
  g.font = 'bold 64px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 26;
  g.fillStyle = color;
  g.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLabelSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.font = 'bold 52px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.lineWidth = 8;
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.strokeText(text, 256, 50);
  g.fillStyle = color;
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(90, 17, 1);
  return sprite;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#17181d';
  g.fillRect(0, 0, 256, 256);
  const rng = makeRng(99);
  for (let i = 0; i < 260; i += 1) {
    g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.25)';
    g.fillRect(rng() * 256, rng() * 256, 2, 2);
  }
  // Centre dashes: two per tile, so a tile spans 128 world units.
  g.fillStyle = '#c9a227';
  g.fillRect(8, 122, 56, 12);
  g.fillRect(136, 122, 56, 12);
  // Edge lines, faint.
  g.fillStyle = 'rgba(232,232,232,0.35)';
  g.fillRect(0, 6, 256, 4);
  g.fillRect(0, 246, 256, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}


// Merge flat plane strips (roads, sidewalks) into one geometry: concatenate
// their transformed attributes so the whole set draws in one call. The dash
// texture's repeat is baked into the UVs (one tile per 128 world units).
function mergePlanes(items) {
  const pos = [];
  const norm = [];
  const uv = [];
  const idx = [];
  let base = 0;
  for (const it of items) {
    const g = new THREE.PlaneGeometry(it.w, it.h);
    g.rotateX(-Math.PI / 2);
    if (it.spin) g.rotateY(Math.PI / 2);
    if (it.uvScale) {
      const uvs = g.attributes.uv;
      for (let i = 0; i < uvs.count; i += 1) uvs.setX(i, uvs.getX(i) * it.uvScale);
    }
    g.translate(it.x, it.y, it.z);
    pos.push(...g.attributes.position.array);
    norm.push(...g.attributes.normal.array);
    uv.push(...g.attributes.uv.array);
    const index = g.index.array;
    for (let i = 0; i < index.length; i += 1) idx.push(index[i] + base);
    base += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

// ---------------------------------------------------------------------------
// Static city: ground, roads, buildings, trees, signs, lights.
// ---------------------------------------------------------------------------
const ROAD_HALF = WORLD.roadWidth / 2;
let glowTexture = null;

function buildStatic() {
  scene.fog = new THREE.Fog(0x070714, 700, 3200);

  // Night light: dim blue ambient, cold moonlight, and hot point lights
  // over the casino strip, the marina and downtown.
  scene.add(new THREE.AmbientLight(0x4a5578, 0.85));
  const moon = new THREE.DirectionalLight(0x9fb4ff, 1.1);
  moon.position.set(800, 1500, -600);
  scene.add(moon);
  const stripLight = (x, y, color, intensity) => {
    const light = new THREE.PointLight(color, intensity, 1100, 1.6);
    light.position.set(tx(x), 90, tz(y));
    scene.add(light);
  };
  stripLight(1705, 2185, 0xffd23d, 22000);
  stripLight(1815, 2185, 0xff2d78, 18000);
  stripLight(2900, 3180, 0xff2d78, 12000);

  // Ground: one dark slab for the whole city.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size, WORLD.size),
    new THREE.MeshLambertMaterial({ color: 0x0b0f16 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  scene.add(ground);

  // Park grass, beach sand, sea.
  const park = new THREE.Mesh(
    new THREE.PlaneGeometry(450, 450),
    new THREE.MeshLambertMaterial({ color: 0x0f2a18 }),
  );
  park.rotation.x = -Math.PI / 2;
  park.position.set(tx(1350), 0.5, tz(1350));
  scene.add(park);
  const beachH = WATER_TOP - BEACH_TOP;
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size, beachH),
    new THREE.MeshLambertMaterial({ color: 0x6b5b3e }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.5, tz(BEACH_TOP + beachH / 2));
  scene.add(beach);
  const waterH = WORLD.size - WATER_TOP;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size, waterH),
    new THREE.MeshLambertMaterial({ color: 0x06283d }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.5, tz(WATER_TOP + waterH / 2));
  scene.add(water);

  // Roads and sidewalks: all strips merged into two meshes (one for the
  // dashed asphalt, one for the sidewalks), so the whole street grid costs
  // two draw calls instead of one per strip.
  const roadTex = makeRoadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const roadItems = [];
  const walkItems = [];
  for (const line of ROAD_LINES) {
    roadItems.push({ w: WORLD.size, h: WORLD.roadWidth, x: 0, y: 1, z: tz(line), uvScale: WORLD.size / 128 });
    roadItems.push({ w: WORLD.size, h: WORLD.roadWidth, x: tx(line), y: 1, z: 0, spin: true, uvScale: WORLD.size / 128 });
    for (const side of [-1, 1]) {
      walkItems.push({ w: WORLD.size, h: WORLD.sidewalk, x: 0, y: 1, z: tz(line + side * (ROAD_HALF + WORLD.sidewalk / 2)) });
      walkItems.push({ w: WORLD.size, h: WORLD.sidewalk, x: tx(line + side * (ROAD_HALF + WORLD.sidewalk / 2)), y: 1, z: 0, spin: true });
    }
  }
  scene.add(new THREE.Mesh(mergePlanes(roadItems), roadMat));
  scene.add(new THREE.Mesh(mergePlanes(walkItems), sidewalkMat));

  // Buildings: boxes with lit-window textures. Four facade variants, plus
  // hot gold/pink/purple fronts for the casino strip.
  const warm = ['#ffd9a0', '#ffe9b0', '#ffb46a'];
  const cool = ['#bfe8ff', '#9fd4ff', '#e8f4ff'];
  const mixed = ['#ffd9a0', '#bfe8ff', '#ff9ecf', '#e8f4ff'];
  const variants = [
    makeWindowTexture('#232833', warm, 11, 0.5),
    makeWindowTexture('#1d2029', cool, 23, 0.42),
    makeWindowTexture('#262233', mixed, 37, 0.55),
    makeWindowTexture('#20242c', warm, 51, 0.3),
  ];
  // Basic (unlit): the window texture already is the night look, and an
  // unlit material costs nothing per pixel in a software renderer.
  const facadeMats = variants.map((tex) => new THREE.MeshBasicMaterial({ map: tex }));
  const casinoTex = makeWindowTexture('#3a2a10', ['#ffd23d', '#ff2d78', '#fff2a8'], 77, 0.85);
  const casinoMat = new THREE.MeshBasicMaterial({ map: casinoTex });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  // One InstancedMesh per facade variant (plus one for the casino strip),
  // so the whole skyline costs five draw calls.
  const buckets = [[], [], [], []];
  const casinoBucket = [];
  let goldenPalms = null;
  CITY.buildings.forEach((b, i) => {
    const inStrip = b.x + b.w / 2 > 1651 && b.x + b.w / 2 < 1949 && b.y + b.h / 2 > 2101 && b.y + b.h / 2 < 2399;
    b._height = b.tall ? 150 + ((i * 37) % 90) : 55 + ((i * 53) % 45);
    if (b.name === 'Golden Palms') goldenPalms = b;
    (inStrip ? casinoBucket : buckets[i % facadeMats.length]).push(b);
  });
  const im4 = new THREE.Matrix4();
  const imq = new THREE.Quaternion();
  const imp = new THREE.Vector3();
  const ims = new THREE.Vector3();
  const placeBoxes = (bucket, mat) => {
    if (!bucket.length) return;
    const im = new THREE.InstancedMesh(boxGeo, mat, bucket.length);
    bucket.forEach((b, j) => {
      im4.compose(imp.set(tx(b.x + b.w / 2), b._height / 2, tz(b.y + b.h / 2)), imq, ims.set(b.w, b._height, b.h));
      im.setMatrixAt(j, im4);
    });
    im.frustumCulled = false;
    scene.add(im);
  };
  buckets.forEach((bucket, i) => placeBoxes(bucket, facadeMats[i]));
  placeBoxes(casinoBucket, casinoMat);
  if (goldenPalms) {
    // A gold crown of light on the casino roof.
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(goldenPalms.w * 0.7, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd23d }),
    );
    crown.position.set(tx(goldenPalms.x + goldenPalms.w / 2), goldenPalms._height + 5, tz(goldenPalms.y + 8));
    scene.add(crown);
  }

  // Port containers: coloured boxes.
  const containerMats = {};
  const containerGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const c of CITY.containers) {
    if (!containerMats[c.color]) {
      containerMats[c.color] = new THREE.MeshLambertMaterial({ color: c.color });
    }
    const mesh = new THREE.Mesh(containerGeo, containerMats[c.color]);
    mesh.scale.set(c.w, 26, c.h);
    mesh.position.set(tx(c.x + c.w / 2), 13, tz(c.y + c.h / 2));
    scene.add(mesh);
  }

  // Trees: instanced cones and trunks — one draw call each for the whole city.
  const treeCount = CITY.trees.length;
  const coneGeo = new THREE.ConeGeometry(1, 1, 7);
  const coneMat = new THREE.MeshLambertMaterial({ color: 0x1d4a26 });
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, treeCount);
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.45, 1, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x2a1e12 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s3 = new THREE.Vector3();
  const p3 = new THREE.Vector3();
  CITY.trees.forEach((t, i) => {
    const h = t.r * 3.4;
    m4.compose(p3.set(tx(t.x), h / 2 + 8, tz(t.y)), q, s3.set(t.r * 2, h, t.r * 2));
    cones.setMatrixAt(i, m4);
    m4.compose(p3.set(tx(t.x), 4, tz(t.y)), q, s3.set(3, 8, 3));
    trunks.setMatrixAt(i, m4);
  });
  scene.add(cones);
  scene.add(trunks);

  // Neon signs: glowing panels that face the street.
  glowTexture = makeGlowTexture();
  for (const sign of NEON_SIGNS) {
    const tex = makeSignTexture(sign.text, sign.color);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(sign.w, sign.h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
    );
    panel.rotation.y = Math.PI / 2 - sign.angle;
    panel.position.set(tx(sign.x), sign.h / 2 + 12, tz(sign.y));
    scene.add(panel);
    // Two posts hold the big beach-road arch sign up, at the panel's ends.
    // The posts must offset along the panel's width (perpendicular to the
    // direction it faces). Offsetting along the facing vector put one post
    // in front of the panel, dead-centre across the NEON BAY text.
    if (sign.w >= 200) {
      const postMat = new THREE.MeshLambertMaterial({ color: 0x1c1f26 });
      for (const off of [-sign.w / 2 + 6, sign.w / 2 - 6]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(8, sign.h + 24, 8), postMat);
        const alongX = -Math.sin(sign.angle);
        const alongY = Math.cos(sign.angle);
        post.position.set(tx(sign.x + alongX * off), (sign.h + 24) / 2, tz(sign.y + alongY * off));
        scene.add(post);
      }
    }
  }
  // (The "CASINO STRIP" floating label was removed: at y=190 it sits
  // behind the casino towers, at y=280 it is above the frame, and the
  // strip's identity already reads from the casino fronts and neon signs.)
}

// ---------------------------------------------------------------------------
// Dynamic objects: cars, people, bullets, particles, markers. Pools keyed
// by game id, so a frame only syncs what the logic already moved.
// ---------------------------------------------------------------------------
const bulletPool = [];
const skidPool = [];
let headlightPool = null;
let targetRing = null;
let targetLabel = null;
let targetLabelText = '';
let startRing = null;
let startLabel = null;
let pickupGlow = null;
let raceRings = [];
let roadblockRings = [];
let points = null;
let pointsPos = null;
let pointsCol = null;
let aimLine = null;
const POINTS_MAX = 600;

// Cars, instanced: one InstancedMesh per part (body, cabin, wheels,
// headlights, taillights, police light bars), so every car on the street
// costs seven draw calls in total. Per-instance colours carry the paint,
// the wreck state and the flashing light bar.
const CAR_MAX = 64;
const carBodyGeo = new THREE.BoxGeometry(CAR.length, 13, CAR.width);
const carCabinGeo = new THREE.BoxGeometry(26, 11, 22);
const wheelGeo = new THREE.CylinderGeometry(6, 6, 5, 10).rotateX(Math.PI / 2);
const headlightGeo = new THREE.BoxGeometry(2, 4, 6);
const taillightGeo = new THREE.BoxGeometry(2, 4, 5);
const barGeo = new THREE.BoxGeometry(8, 4, 6);
const glassMat = new THREE.MeshLambertMaterial({ color: 0x10151f });
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0c0e });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
const WHEEL_SPOTS = [[17, 13], [17, -13], [-17, 13], [-17, -13]];
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s1 = new THREE.Vector3(1, 1, 1);
const _s0 = new THREE.Vector3(0, 0, 0);
const _c = new THREE.Color();
let carIM = null;

// Write one part instance: a local offset, rotated by the owner's
// quaternion, added to the owner's world position.
function putPart(im, index, wx, wy, wz, q, lx, ly, lz, scale) {
  _p.set(lx, ly, lz).applyQuaternion(q);
  _p.x += wx;
  _p.y += wy;
  _p.z += wz;
  _m4.compose(_p, q, scale || _s1);
  im.setMatrixAt(index, _m4);
}

function initCarInstancing() {
  const mk = (geo, mat, count) => {
    const im = new THREE.InstancedMesh(geo, mat, count);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    scene.add(im);
    return im;
  };
  carIM = {
    body: mk(carBodyGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), CAR_MAX),
    cabin: mk(carCabinGeo, glassMat, CAR_MAX),
    wheel: mk(wheelGeo, wheelMat, CAR_MAX * 4),
    head: mk(headlightGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), CAR_MAX * 2),
    tail: mk(taillightGeo, tailMat, CAR_MAX * 2),
    barRed: mk(barGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), CAR_MAX),
    barBlue: mk(barGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), CAR_MAX),
    glows: [],
  };
  for (let i = 0; i < 6; i += 1) {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: 0xff2d2d, transparent: true, opacity: 0.35, depthWrite: false,
    }));
    glow.scale.set(70, 70, 1);
    glow.visible = false;
    scene.add(glow);
    carIM.glows.push(glow);
  }
}

function syncCars(state) {
  if (!carIM) initCarInstancing();
  const cars = state.cars;
  const n = Math.min(cars.length, CAR_MAX);
  const phase = policeLightPhase(state);
  let gi = 0;
  for (let i = 0; i < n; i += 1) {
    const car = cars[i];
    _e.set(0, -car.angle, car.wrecked ? 0.06 : 0);
    _q.setFromEuler(_e);
    const wx = tx(car.x);
    const wz = tz(car.y);
    putPart(carIM.body, i, wx, 0, wz, _q, 0, 9, 0);
    _c.set(car.wrecked ? '#3a3a3a' : car.color);
    carIM.body.setColorAt(i, _c);
    putPart(carIM.cabin, i, wx, 0, wz, _q, -3, 20, 0);
    for (let w = 0; w < 4; w += 1) {
      putPart(carIM.wheel, i * 4 + w, wx, 0, wz, _q, WHEEL_SPOTS[w][0], 6, WHEEL_SPOTS[w][1]);
    }
    const lightsOn = car.lights && !car.wrecked;
    _c.set(lightsOn ? 0xfff2b0 : 0x222222);
    for (let s = 0; s < 2; s += 1) {
      const z = s === 0 ? 8 : -8;
      putPart(carIM.head, i * 2 + s, wx, 0, wz, _q, CAR.length / 2 + 0.5, 9, z);
      carIM.head.setColorAt(i * 2 + s, _c);
      putPart(carIM.tail, i * 2 + s, wx, 0, wz, _q, -CAR.length / 2 - 0.5, 9, z);
    }
    if (car.type === 'police') {
      putPart(carIM.barRed, i, wx, 0, wz, _q, 0, 27, -4);
      putPart(carIM.barBlue, i, wx, 0, wz, _q, 0, 27, 4);
      carIM.barRed.setColorAt(i, _c.set(phase === 0 ? 0xff2d2d : 0x551111));
      carIM.barBlue.setColorAt(i, _c.set(phase === 0 ? 0x111155 : 0x2d5bff));
      if (gi < carIM.glows.length) {
        const glow = carIM.glows[gi];
        gi += 1;
        glow.position.set(wx, 40, wz);
        glow.material.color.setHex(phase === 0 ? 0xff2d2d : 0x2d5bff);
        glow.material.opacity = 0.25 + 0.15 * Math.sin(state.time * 12);
        glow.visible = true;
      }
    } else {
      putPart(carIM.barRed, i, wx, 0, wz, _q, 0, 27, -4, _s0);
      putPart(carIM.barBlue, i, wx, 0, wz, _q, 0, 27, 4, _s0);
    }
  }
  for (; gi < carIM.glows.length; gi += 1) carIM.glows[gi].visible = false;
  carIM.body.count = n;
  carIM.cabin.count = n;
  carIM.wheel.count = n * 4;
  carIM.head.count = n * 2;
  carIM.tail.count = n * 2;
  carIM.barRed.count = n;
  carIM.barBlue.count = n;
  for (const im of Object.values(carIM)) {
    if (!im.isInstancedMesh) continue;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }
}

// People, instanced: one InstancedMesh per part (legs, torso, head, cap),
// so every pedestrian, guard and the player cost four draw calls in total.
// Per-instance colours carry shirts and skin; the walk bob and the lying
// pose are baked into the matrices. Arms are left out at this scale.
const PPL_MAX = 64;
const legsGeo = new THREE.BoxGeometry(12, 12, 10);
const torsoGeo = new THREE.BoxGeometry(14, 20, 10);
const headGeo = new THREE.SphereGeometry(6.5, 10, 8);
const capGeo = new THREE.BoxGeometry(12, 3, 12);
const legsMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
const capMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
let pplIM = null;
let playerRing = null;

function initPeopleInstancing() {
  const mk = (geo, mat, count) => {
    const im = new THREE.InstancedMesh(geo, mat, count);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    scene.add(im);
    return im;
  };
  pplIM = {
    legs: mk(legsGeo, legsMat, PPL_MAX),
    torso: mk(torsoGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), PPL_MAX),
    head: mk(headGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), PPL_MAX),
    cap: mk(capGeo, capMat, PPL_MAX),
  };
  // The white ring under the player's feet, so he reads in a crowd.
  playerRing = flatRing(13, 16, 0xffffff, 0.8);
  playerRing.position.y = 1;
}

// One person into the instanced lists. `shirt` and `skin` are colours;
// guards get a cap.
function putPerson(state, x, y, angle, walkPhase, down, moving, shirt, skin, isGuard) {
  const n = state._pplN;
  if (n >= PPL_MAX) return;
  const baseY = down ? 4 : (moving ? Math.abs(Math.sin(walkPhase)) * 1.6 : 0);
  _e.set(down ? Math.PI / 2 : 0, -angle, 0);
  _q.setFromEuler(_e);
  const wx = tx(x);
  const wz = tz(y);
  putPart(pplIM.legs, n, wx, baseY, wz, _q, 0, 6, 0);
  putPart(pplIM.torso, n, wx, baseY, wz, _q, 0, 22, 0);
  _c.set(shirt);
  pplIM.torso.setColorAt(n, _c);
  putPart(pplIM.head, n, wx, baseY, wz, _q, 0, 37, 0);
  _c.set(skin);
  pplIM.head.setColorAt(n, _c);
  if (isGuard) {
    putPart(pplIM.cap, state._pplCaps, wx, baseY, wz, _q, 0, 43, 0);
    state._pplCaps += 1;
  }
  state._pplN = n + 1;
}

function syncPeople(state) {
  if (!pplIM) initPeopleInstancing();
  const player = state.player;
  state._pplN = 0;
  state._pplCaps = 0;
  if (player.onFoot) {
    putPerson(state, player.x, player.y, player.angle, player.walkPhase || 0, false, player.speed > 4, PALETTE.player, '#e8b98a', false);
    playerRing.position.set(tx(player.x), 1, tz(player.y));
    playerRing.visible = true;
  } else {
    playerRing.visible = false;
  }
  for (const ped of state.peds) {
    putPerson(state, ped.x, ped.y, ped.angle, ped.walkPhase || 0, ped.down, ped.state !== 'walk' || ped.speed > 0, ped.shirt, ped.skin, false);
  }
  for (const guard of state.guards) {
    putPerson(state, guard.x, guard.y, guard.angle, 0, guard.down, false, '#3a3a3a', '#e8b98a', true);
  }
  const n = state._pplN;
  pplIM.legs.count = n;
  pplIM.torso.count = n;
  pplIM.head.count = n;
  pplIM.cap.count = state._pplCaps;
  for (const im of Object.values(pplIM)) {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }
}

function flatRing(inner, outer, color, opacity) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 2;
  scene.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// Frame: sync every dynamic object from the game state, then render.
// ---------------------------------------------------------------------------
export function drawWorld(state, camera) {
  if (!rendererOK) return;
  // The camera follows the player; the HUD reads camera.x/y as a 2D origin.
  updateCamera(camera, state, 0.016);

  // Cars and people, instanced.
  syncCars(state);
  syncPeople(state);

  // The headlight pool: a cheap additive glow on the road ahead of the
  // player's car, standing in for a real spotlight (a spotlight costs a
  // light evaluation on every fragment of every lit material).
  const player = state.player;
  if (!headlightPool) {
    headlightPool = new THREE.Mesh(
      new THREE.PlaneGeometry(380, 170),
      new THREE.MeshBasicMaterial({
        map: glowTexture, color: 0xffe9b0, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    headlightPool.rotation.x = -Math.PI / 2;
    headlightPool.position.y = 1.5;
    scene.add(headlightPool);
  }
  if (!player.onFoot && player.car && !player.car.wrecked) {
    const c = player.car;
    headlightPool.position.set(
      tx(c.x + Math.cos(c.angle) * 190), 1.5, tz(c.y + Math.sin(c.angle) * 190),
    );
    headlightPool.rotation.z = -c.angle;
    headlightPool.visible = true;
  } else {
    headlightPool.visible = false;
  }

  // Bullets: gold for the player, red for the enemy.
  if (!bulletPool.length) {
    const geo = new THREE.SphereGeometry(4, 8, 6);
    for (let i = 0; i < 160; i += 1) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe14d }));
      m.visible = false;
      scene.add(m);
      bulletPool.push(m);
    }
  }
  state.bullets.forEach((b, i) => {
    if (i >= bulletPool.length) return;
    const m = bulletPool[i];
    m.material.color.setHex(b.from === 'player' ? 0xffe14d : 0xff4d4d);
    m.position.set(tx(b.x), 14, tz(b.y));
    m.visible = true;
  });
  for (let i = state.bullets.length; i < bulletPool.length; i += 1) bulletPool[i].visible = false;

  // Particles as one THREE.Points cloud, fed from the logic's list.
  if (!points) {
    const geo = new THREE.BufferGeometry();
    pointsPos = new Float32Array(POINTS_MAX * 3);
    pointsCol = new Float32Array(POINTS_MAX * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pointsPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(pointsCol, 3));
    points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 7, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
    }));
    points.frustumCulled = false;
    scene.add(points);
  }
  const list = state.particles.list;
  const n = Math.min(list.length, POINTS_MAX);
  const col = new THREE.Color();
  for (let i = 0; i < n; i += 1) {
    const p = list[i];
    pointsPos[i * 3] = tx(p.x);
    pointsPos[i * 3 + 1] = 12 + (1 - p.life / p.maxLife) * 26;
    pointsPos[i * 3 + 2] = tz(p.y);
    col.set(p.color);
    const a = Math.max(0.15, p.life / p.maxLife);
    pointsCol[i * 3] = col.r * a;
    pointsCol[i * 3 + 1] = col.g * a;
    pointsCol[i * 3 + 2] = col.b * a;
  }
  points.geometry.setDrawRange(0, n);
  points.geometry.attributes.position.needsUpdate = true;
  points.geometry.attributes.color.needsUpdate = true;

  // Skid marks: dark strips on the road, oldest first.
  if (!skidPool.length) {
    const geo = new THREE.PlaneGeometry(28, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.4, depthWrite: false });
    for (let i = 0; i < 60; i += 1) {
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 1.5;
      m.visible = false;
      scene.add(m);
      skidPool.push(m);
    }
  }
  const skids = state.particles.skids;
  skids.slice(-60).forEach((s, i) => {
    const m = skidPool[i];
    m.position.set(tx(s.x), 1.5, tz(s.y));
    m.rotation.z = -s.angle;
    m.visible = true;
  });
  for (let i = Math.min(skids.length, 60); i < skidPool.length; i += 1) skidPool[i].visible = false;

  // Mission target ring + label, pulsing.
  if (!targetRing) {
    targetRing = flatRing(30, 38, 0xffd23d, 0.9);
    targetLabel = makeLabelSprite('', NEON.gold);
    scene.add(targetLabel);
  }
  if (state.missions.target) {
    const t = state.missions.target;
    const pulse = 1 + 0.12 * Math.sin(state.time * 5);
    targetRing.scale.set(pulse, pulse, 1);
    targetRing.position.set(tx(t.x), 2, tz(t.y));
    targetRing.visible = true;
    if (t.label !== targetLabelText) {
      targetLabelText = t.label;
      scene.remove(targetLabel);
      targetLabel = makeLabelSprite(t.label, NEON.gold);
      scene.add(targetLabel);
    }
    targetLabel.position.set(tx(t.x), 64, tz(t.y));
    targetLabel.visible = true;
  } else {
    targetRing.visible = false;
    targetLabel.visible = false;
  }

  // Pickup glow: a green light over the cash/ledger when it can be grabbed.
  if (!pickupGlow) {
    pickupGlow = new THREE.Mesh(
      new THREE.SphereGeometry(10, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x7dff8a }),
    );
    scene.add(pickupGlow);
  }
  if (state.missions.pickupReady && state.missions.target) {
    const t = state.missions.target;
    pickupGlow.position.set(tx(t.x), 16 + 3 * Math.sin(state.time * 6), tz(t.y));
    pickupGlow.visible = true;
  } else {
    pickupGlow.visible = false;
  }

  // The yellow M: where the next job starts.
  if (!startRing) {
    startRing = flatRing(18, 24, 0xffd23d, 0.9);
    startLabel = makeLabelSprite('M', NEON.gold);
    startLabel.scale.set(60, 60, 1);
    scene.add(startLabel);
  }
  if (!state.missions.active && state.missions.index < 10 && state.missionStart) {
    const s = state.missionStart;
    const pulse = 1 + 0.15 * Math.sin(state.time * 5);
    startRing.scale.set(pulse, pulse, 1);
    startRing.position.set(tx(s.x), 2, tz(s.y));
    startRing.visible = true;
    startLabel.position.set(tx(s.x), 54, tz(s.y));
    startLabel.visible = true;
  } else {
    startRing.visible = false;
    startLabel.visible = false;
  }

  // Race checkpoints still to hit, purple rings.
  if (!raceRings.length) {
    for (let i = 0; i < 4; i += 1) {
      const r = flatRing(34, 42, 0xb06fd8, 0.9);
      raceRings.push(r);
    }
  }
  if (state.race && state.race.active) {
    for (let i = 0; i < 4; i += 1) {
      const cp = state.race.checkpoints[state.race.cpIndex + i];
      if (cp) {
        raceRings[i].position.set(tx(cp.x), 2, tz(cp.y));
        raceRings[i].visible = true;
      } else {
        raceRings[i].visible = false;
      }
    }
  } else {
    raceRings.forEach((r) => { r.visible = false; });
  }

  // Roadblocks: red rings under dispatch's parked cruisers.
  if (!roadblockRings.length) {
    for (let i = 0; i < 3; i += 1) {
      const r = flatRing(34, 42, 0xff2d2d, 0.85);
      roadblockRings.push(r);
    }
  }
  if (state.dispatch) {
    state.dispatch.roadblocks.forEach((c, i) => {
      if (i >= roadblockRings.length) return;
      const pulse = 1 + 0.1 * Math.sin(state.time * 6);
      roadblockRings[i].scale.set(pulse, pulse, 1);
      roadblockRings[i].position.set(tx(c.x), 2, tz(c.y));
      roadblockRings[i].visible = true;
    });
    for (let i = state.dispatch.roadblocks.length; i < roadblockRings.length; i += 1) {
      roadblockRings[i].visible = false;
    }
  }

  // Aim line: a short white line from the player when armed on foot.
  if (!aimLine) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    aimLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    aimLine.frustumCulled = false;
    scene.add(aimLine);
  }
  if (player.onFoot && player.weapon === 'pistol') {
    const pos = aimLine.geometry.attributes.position.array;
    pos[0] = tx(player.x);
    pos[1] = 18;
    pos[2] = tz(player.y);
    pos[3] = tx(player.x + Math.cos(player.aimAngle) * 46);
    pos[4] = 18;
    pos[5] = tz(player.y + Math.sin(player.aimAngle) * 46);
    aimLine.geometry.attributes.position.needsUpdate = true;
    aimLine.visible = true;
  } else {
    aimLine.visible = false;
  }

  renderer.render(scene, threeCam);
}

// ---------------------------------------------------------------------------
// Setup. Call once with the WebGL canvas before the first frame.
// ---------------------------------------------------------------------------
export function initRenderer(canvas) {
  if (renderer) return rendererOK;
  try {
    // No antialiasing: in a software renderer (headless SwiftShader) MSAA
    // costs seconds per frame, and the game must stay playable there.
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  } catch (error) {
    window.__webglError = String(error);
    return false;
  }
  renderer.setSize(VIEW.width, VIEW.height, false);
  renderer.setPixelRatio(1);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070714);
  threeCam = new THREE.PerspectiveCamera(CAMERA3D.fov, VIEW.width / VIEW.height, 1, 6000);
  buildStatic();
  rendererOK = true;
  // Debug handle: draw-call and triangle counts for performance checks.
  window.__renderer = renderer;
  return true;
}

export function isRendererOK() {
  return rendererOK;
}
