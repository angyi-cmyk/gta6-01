// Tuning and world constants for Neon Bay Nights.
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
  reward: [500, 1200, 3000, 800, 1500, 2000, 2500, 4000, 5000, 8000],
  startCash: 120,
};

// Chase camera: how far behind and above the player the 3D camera rides.
// Driving sits lower and closer for speed; on foot it pulls up and back so
// the street reads.
export const CAMERA3D = {
  fov: 62,
  driveDist: 210,
  driveHeight: 100,
  footDist: 150,
  footHeight: 120,
  lookAhead: 90, // how far past the player the camera looks
  smooth: 5.0, // exponential follow rate (per second)
};

// Neon-night palette: dark wet streets, lit windows, hot sign colours. The
// 2D HUD still reads these for its own drawing (player shirt, car colours).
export const PALETTE = {
  grass: '#14261c',
  grassDry: '#1d3325',
  sand: '#8a7a55',
  water: '#0a2a3d',
  waterDeep: '#071e2d',
  road: '#17181d',
  roadEdge: '#101116',
  lane: '#e8d44d',
  sidewalk: '#3a3d46',
  buildingRoof: ['#2a2f3a', '#33272f', '#241f2e', '#1f2a33', '#2e2a26', '#262033', '#1e2b26'],
  buildingWall: ['#3d3a4a', '#463a4a', '#37404f', '#41384a'],
  park: '#14301c',
  tree: ['#1d4a26', '#256030', '#2f7038'],
  car: ['#d94f3d', '#3d7dd9', '#e8c832', '#e8e8e8', '#2f2f38', '#7ac74f', '#d97ab0', '#38b8a8'],
  policeCar: '#e8e8e8',
  taxi: '#f2c230',
  player: '#e8503a',
  cop: '#2b4d8f',
  ped: ['#e8b98a', '#c98a5f', '#8a5a3c', '#f0c8a0'],
  shirt: ['#d94f3d', '#3d7dd9', '#e8c832', '#7ac74f', '#d97ab0', '#38b8a8', '#f2f2f2', '#8a6f8e'],
};

// Neon sign colours, one per landmark sign on the strip.
export const NEON = {
  gold: '#ffd23d',
  pink: '#ff2d78',
  cyan: '#2de8ff',
  purple: '#b06fd8',
  green: '#7dff8a',
  orange: '#ff9a3d',
};
