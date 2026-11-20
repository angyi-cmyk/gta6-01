// Screenshot scenes behind ?shot=cover|foot|chase|mission. Each one plays the
// real game forward from a fixed seed for a fixed number of steps, steered by
// a simple autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame. One job: stage a good photo.
import { VIEW, WORLD } from './config.js';
import { makeRng, clamp, angleDelta, distance } from './random.js';
import { makePlayer, updateOnFoot, updateDriving, enterCar } from './player.js';
import { makeCar, updateTrafficCar, collideCars } from './vehicles.js';
import { updatePedestrian, scarePedestrians } from './pedestrians.js';
import { updateParticles, addParticles } from './particles.js';
import { makeWanted, addWanted, balancePolice, updatePoliceCar, spawnPoliceCar } from './police.js';
import { updateBullets, enemyShoot } from './combat.js';
import { updateMissions, missionStartPoint, missionSpots } from './missions.js';
import { updateCamera } from './render.js';
import { makeMissions } from './missions.js';

const STEP = 1 / 60;

// Drive toward a list of waypoints in a loop, like a player who knows the
// city: slow down for corners and brake for the car ahead. Returns
// {steer, throttle} for this step.
function driveToward(car, waypoints, waypointIndex, state) {
  const target = waypoints[waypointIndex.value % waypoints.length];
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  if (Math.hypot(dx, dy) < 110) waypointIndex.value += 1;
  const wantAngle = Math.atan2(dy, dx);
  const delta = angleDelta(car.angle, wantAngle);
  let throttle = Math.abs(delta) > 0.9 ? 0.25 : Math.abs(delta) > 0.45 ? 0.55 : 1;
  // Brake for a car right ahead.
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of state.cars) {
    if (other === car || other.wrecked) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const ahead = ox * fx + oy * fy;
    const side = Math.abs(ox * -fy + oy * fx);
    if (ahead > 0 && ahead < 150 && side < 42) {
      throttle = -0.5;
      break;
    }
  }
  return { steer: clamp(delta * 1.8, -1, 1), throttle };
}

function stepWorld(state, dt) {
  for (const car of state.cars) {
    if (car.driver === 'traffic') updateTrafficCar(car, state, dt);
    else if (car.driver === 'police') updatePoliceCar(car, state, dt);
  }
  for (let i = 0; i < state.cars.length; i += 1) {
    for (let j = i + 1; j < state.cars.length; j += 1) {
      collideCars(state.cars[i], state.cars[j], state);
    }
  }
  for (const ped of state.peds) updatePedestrian(ped, state, dt, null);
  // Guards chase and shoot like the real game.
  for (const guard of state.guards) {
    if (guard.down) continue;
    const player = state.player;
    const d = distance(guard.x, guard.y, player.x, player.y);
    if (d < 420) guard.alerted = true;
    if (!guard.alerted) continue;
    const angle = Math.atan2(player.y - guard.y, player.x - guard.x);
    guard.angle = angle;
    if (d > 130) {
      guard.x += Math.cos(angle) * guard.speed * dt;
      guard.y += Math.sin(angle) * guard.speed * dt;
    }
    guard.shootCooldown -= dt;
    if (d < 430 && guard.shootCooldown <= 0) {
      guard.shootCooldown = 1.15;
      const bullet = enemyShoot(guard, state);
      if (bullet) state.bullets.push(bullet);
    }
  }
  updateBullets(state, dt);
  updateParticles(state, dt);
  updateMissions(state, dt);
  balancePolice(state);
  updateCamera(state.camera, state.player.x, state.player.y, dt);
  state.time += dt;
}

// Put the player in a car at (x, y) facing `angle`, driving already.
function putPlayerInCar(state, x, y, angle, color) {
  const car = makeCar(x, y, angle, { type: 'player', driver: 'player', color: color || '#d94f3d', topSpeed: 430 });
  state.cars.push(car);
  enterCar(state.player, car);
  state.player.x = x;
  state.player.y = y;
  return car;
}

function downtownLoop() {
  return [
    { x: 1575, y: 1575 }, { x: 2475, y: 1575 }, { x: 2475, y: 2475 },
    { x: 1575, y: 2475 }, { x: 1575, y: 2025 }, { x: 2025, y: 2025 },
  ];
}

// Cover: driving downtown at two stars with cruisers on the tail.
function stageCover(state) {
  state.wanted.stars = 2;
  const car = putPlayerInCar(state, 1575, 1575, 0, '#d94f3d');
  spawnPoliceCar(state);
  spawnPoliceCar(state);
  const waypoints = downtownLoop();
  const index = { value: 0 };
  for (let i = 0; i < 12 / STEP; i += 1) {
    if (car.wrecked) break;
    const drive = driveToward(car, waypoints, index, state);
    updateDriving(car, drive.steer, drive.throttle, false, STEP);
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = car.angle;
    stepWorld(state, STEP);
  }
  state.missions.objective = 'Deliver the Comet GT to Delia\'s garage';
  state.missions.target = { x: 3230, y: 675, label: 'Garage' };
}

// On foot at the Marina, mission one waiting, pedestrians about. The player
// walks south toward the yellow M, so the marker stays in frame.
function stageFoot(state) {
  const player = state.player;
  player.x = 2900;
  player.y = 3100;
  player.aimAngle = -Math.PI / 2;
  state.missionStart = { x: 2900, y: 3180 };
  // A few pedestrians strolling the marina front.
  for (let i = 0; i < 6; i += 1) {
    state.peds[i].x = 2750 + i * 55;
    state.peds[i].y = 3080 + (i % 2) * 60;
  }
  for (let i = 0; i < 2.5 / STEP; i += 1) {
    updateOnFoot(player, { x: 0, y: 0.4 }, STEP, false);
    stepWorld(state, STEP);
  }
}

// A four-star chase: five cruisers, the player flat out.
function stageChase(state) {
  state.wanted.stars = 4;
  const car = putPlayerInCar(state, 1125, 1125, 0, '#3d7dd9');
  for (let i = 0; i < 4; i += 1) spawnPoliceCar(state);
  const waypoints = downtownLoop();
  const index = { value: 0 };
  for (let i = 0; i < 11 / STEP; i += 1) {
    if (car.wrecked) break;
    const drive = driveToward(car, waypoints, index, state);
    updateDriving(car, drive.steer, drive.throttle, i % 240 > 200, STEP);
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = car.angle;
    stepWorld(state, STEP);
  }
}

// Mission three in progress: guards alerted, the player armed at the tower.
// The player strafes along the road north of the tower and shoots back — a
// short, survivable firefight, not a walk into the open.
function stageMission(state) {
  const player = state.player;
  player.weapon = 'pistol';
  const tower = missionSpots().tower;
  player.x = tower.x;
  player.y = tower.y - 260; // on the road north of the tower
  player.aimAngle = Math.PI / 2;
  const guards = [];
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2;
    guards.push({
      x: tower.x + Math.cos(angle) * 150,
      y: tower.y + Math.sin(angle) * 150,
      angle,
      health: 60,
      down: false,
      alerted: true,
      shootCooldown: 0.4 + i * 0.3,
      speed: 120,
    });
  }
  state.guards = guards;
  state.missions.index = 2;
  state.missions.active = true;
  state.missions.stage = 0;
  state.missions.objective = 'Fight past Rourke\'s guards at Solmar Tower';
  state.missions.target = { x: tower.x, y: tower.y, label: 'Solmar Tower' };
  state.missions.dialogue = { text: 'Delia: "Four of his men guard the door. Take the ledger and meet me at the safehouse."', seconds: 6 };
  addWanted(state, 1, 'the tower alarm went off');
  for (let i = 0; i < 4 / STEP; i += 1) {
    // Strafe east and west along the road; fire at the nearest guard.
    const strafe = Math.floor(i / 48) % 2 === 0 ? 1 : -1;
    const guard = state.guards.find((g) => !g.down);
    if (guard) {
      player.aimAngle = Math.atan2(guard.y - player.y, guard.x - player.x);
      if (i % 30 === 0) {
        state.bullets.push({
          x: player.x + Math.cos(player.aimAngle) * 20,
          y: player.y + Math.sin(player.aimAngle) * 20,
          vx: Math.cos(player.aimAngle) * 900,
          vy: Math.sin(player.aimAngle) * 900,
          life: 0.9, damage: 26, from: 'player',
        });
      }
    }
    updateOnFoot(player, { x: strafe, y: 0 }, STEP, false);
    stepWorld(state, STEP);
    if (player.health <= 0) break;
  }
}

/**
 * Set `state` to the named scene (cover, foot, chase or mission) and return
 * it. The state is a fresh world with a fixed seed, so the frame is stable.
 */
export function stageShot(name, state) {
  const staged = state;
  staged.rng = makeRng(7);
  staged.time = 0;
  staged.wanted = makeWanted();
  staged.missions = makeMissions();
  staged.missions.onGuardDown = () => {};
  staged.guards = [];
  staged.bullets = [];
  if (name === 'foot') stageFoot(staged);
  else if (name === 'chase') stageChase(staged);
  else if (name === 'mission') stageMission(staged);
  else stageCover(staged);
  updateCamera(staged.camera, staged.player.x, staged.player.y, 1);
  return staged;
}
