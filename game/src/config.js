// Tuning and world constants for Solmar Heat.
// One file, one job: every number the game balances on lives here.
export const WORLD = {
  size: 3600, // the city is a square, WORLD.size x WORLD.size pixels
  roadPitch: 450, // distance between parallel road centre lines
  roadWidth: 84,
  sidewalk: 26, // sidewalk strip on each side of a road
  blockMargin: 34, // buildings keep this far inside a block
};

export const VIEW = { width: 1280, height: 720 };

export const PLAYER = {
  walkSpeed: 210,
  runSpeed: 330,
  radius: 14,
  maxHealth: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.38,
  shotDamage: 26,
  shotCooldown: 0.32,
  bulletSpeed: 900,
};

export const CAR = {
  length: 52,
  width: 26,
  // arcade handling: acceleration, top speed, steering
  accel: 420,
  brake: 700,
  reverseTop: 140,
  grip: 3.4, // how fast lateral velocity is killed (higher = grippier)
  handbrakeGrip: 0.9,
  maxHealth: 100,
};

export const TRAFFIC = {
  count: 26,
  speedMin: 95,
  speedMax: 165,
  spawnSafeRadius: 520, // do not spawn traffic right on top of the player
};

export const PEDESTRIANS = { count: 42, walkMin: 34, walkMax: 62, fleeSpeed: 150 };

export const POLICE = {
  maxCars: 6, // at 5 stars
  chaseSpeed: 430,
  ramDamage: 9,
  // seconds of no crime and no police nearby before one star drops
  cooldownPerStar: 16,
  bustHoldSeconds: 2.5, // police beside a stopped player car before BUSTED
};

export const WANTED = {
  stealCar: 1,
  hitPedestrian: 1,
  shootInPublic: 1,
  killPedestrian: 2,
  killCop: 2,
  stealPoliceCar: 2,
};

export const MISSIONS = {
  reward: [500, 1200, 3000],
  startCash: 120,
};

// Sun-soaked palette: warm sand, teal water, terracotta roofs.
export const PALETTE = {
  grass: '#7fae62',
  grassDry: '#a8b06a',
  sand: '#e8cf9a',
  water: '#2f8fae',
  waterDeep: '#24708c',
  road: '#3c3f46',
  roadEdge: '#2c2f35',
  lane: '#e8d44d',
  sidewalk: '#b9b3a4',
  buildingRoof: ['#c96f4a', '#d98e5f', '#b85c5c', '#7d8aa0', '#a08a6a', '#8a6f8e', '#5f7d6a'],
  buildingWall: ['#e8dcc8', '#dfd2b8', '#e5c9a8', '#d8cbb2'],
  park: '#5d9b4e',
  tree: ['#3f7a34', '#4d8a3c', '#5da244'],
  car: ['#d94f3d', '#3d7dd9', '#e8c832', '#e8e8e8', '#2f2f38', '#7ac74f', '#d97ab0', '#38b8a8'],
  policeCar: '#e8e8e8',
  taxi: '#f2c230',
  player: '#e8503a',
  cop: '#2b4d8f',
  ped: ['#e8b98a', '#c98a5f', '#8a5a3c', '#f0c8a0'],
  shirt: ['#d94f3d', '#3d7dd9', '#e8c832', '#7ac74f', '#d97ab0', '#38b8a8', '#f2f2f2', '#8a6f8e'],
};
