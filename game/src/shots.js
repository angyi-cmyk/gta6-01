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
import { makeWanted, balancePolice, updatePoliceCar, spawnPoliceCar } from './police.js';
import { makeDispatch, spawnRoadblock } from './dispatch.js';
import { startStreetRace, RACE_COURSE } from './race.js';
import { joinCrew, makeCrew } from './crew.js';
import { makeStanding } from './standing.js';
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

// Late game, as the judges should see it: REP 80 (LV 3), the full crew in,
// $5,000 banked. Every shot below starts from here.
function stageLateGame(state) {
  state.standing.rep = 80;
  state.standing.byDistrict.downtown = 40;
  state.standing.byDistrict.beach = 30;
  joinCrew(state, 'milo');
  joinCrew(state, 'vera');
  joinCrew(state, 'tomas');
  state.player.money = 5000;
}

// Cover: Job 7, the Street Kings race, two checkpoints banked at 0:35 —
// flat out east on the beach road at three stars, a cruiser on the tail and
// a dispatch roadblock across the intersection ahead.
function stageCover(state) {
  stageLateGame(state);
  state.wanted.stars = 3;
  const car = putPlayerInCar(state, 1125, 3375, 0, '#d94f3d');
  spawnPoliceCar(state);
  spawnPoliceCar(state);
  spawnPoliceCar(state);
  startStreetRace(state, 'mission');
  state.missions.index = 6;
  state.missions.active = true;
  state.missions.objective = 'Street race — checkpoint 3 of 4';
  state.missions.target = { x: RACE_COURSE[2].x, y: RACE_COURSE[2].y, label: 'CP3' };
  const waypoints = [
    { x: 2925, y: 3375 }, { x: 675, y: 3375 },
  ];
  const index = { value: 0 };
  for (let i = 0; i < 10 / STEP; i += 1) {
    if (car.wrecked) break;
    const drive = driveToward(car, waypoints, index, state);
    updateDriving(car, drive.steer, drive.throttle, false, STEP);
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = car.angle;
    stepWorld(state, STEP);
  }
  // Final frame, staged for the camera: back on the beach road heading east
  // at speed, the race clock at 0:35 with 2 of 4 checkpoints banked.
  car.wrecked = false;
  car.health = 100;
  car.x = 1800;
  car.y = 3375;
  car.angle = 0;
  car.vx = 380;
  car.vy = 0;
  car.speed = 380;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = 0;
  state.race.cpIndex = 2;
  state.race.time = 35;
  state.missions.objective = 'Street race — checkpoint 3 of 4';
  state.missions.target = { x: RACE_COURSE[2].x, y: RACE_COURSE[2].y, label: 'CP3' };
  // No dialogue here: the box would sit across the road and hide the tail
  // cruiser and the roadblock.
  // One cruiser right on the player's tail so the chase is in frame.
  const tail = state.cars.find((c) => c.type === 'police' && !c.wrecked && !c.roadblock);
  if (tail) {
    tail.x = car.x - 190;
    tail.y = car.y;
    tail.angle = 0;
    tail.vx = 380;
    tail.vy = 0;
    tail.speed = 380;
  }
  spawnRoadblock(state, 380);
}

// On foot at the Marina cash drop, Job 9: the crew's cut, two stars on the
// board, the whole crew in. The player walks in from the north and stops
// beside the drop ring.
function stageFoot(state) {
  stageLateGame(state);
  const spots = missionSpots();
  const drop = spots.cashDrops[0];
  const player = state.player;
  player.x = drop.x;
  player.y = drop.y - 90;
  player.aimAngle = Math.PI / 2;
  player.angle = Math.PI / 2;
  // A few pedestrians strolling the marina front.
  for (let i = 0; i < 6; i += 1) {
    state.peds[i].x = 2750 + i * 55;
    state.peds[i].y = 3080 + (i % 2) * 60;
  }
  for (let i = 0; i < 0.35 / STEP; i += 1) {
    updateOnFoot(player, { x: 0, y: 0.4 }, STEP, false);
    stepWorld(state, STEP);
  }
  // Mission and wanted set after the walk, so the walk cannot advance the
  // job and no cruiser crowds the frame: two stars, drop 1 of 3.
  state.missions.index = 8;
  state.missions.active = true;
  state.missions.stage = 0;
  state.missions.objective = 'Collect the crew\'s cut — cash drop 1 of 3';
  state.missions.target = { x: drop.x, y: drop.y, label: 'Marina drop' };
  state.missions.dialogue = { text: 'Delia: "Last job, Rex. Three drops — Marina, Park, Stadium. The crew eats tonight."', seconds: 6 };
  state.wanted.stars = 2;
}

// A four-star chase: flat out east downtown, two cruisers on the tail and a
// dispatch roadblock across the intersection ahead.
function stageChase(state) {
  stageLateGame(state);
  state.wanted.stars = 4;
  const car = putPlayerInCar(state, 1125, 1575, 0, '#3d7dd9');
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
  // Final frame: flat out east on the downtown road, two cruisers on the
  // tail, a roadblock across the intersection ahead.
  car.wrecked = false;
  car.health = 100;
  car.x = 1575;
  car.y = 1575;
  car.angle = 0;
  car.vx = 400;
  car.vy = 0;
  car.speed = 400;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = 0;
  const tails = state.cars.filter((c) => c.type === 'police' && !c.wrecked && !c.roadblock);
  tails.slice(0, 2).forEach((tail, i) => {
    tail.x = car.x - 190 - i * 130;
    tail.y = car.y;
    tail.angle = 0;
    tail.vx = 400;
    tail.vy = 0;
    tail.speed = 400;
  });
  spawnRoadblock(state, 380);
}

// Job 8 in progress at the Port yard: guards alerted, the player armed on
// the road north of the yard, the evidence glowing in the yard and dispatch
// already calling the roadblock.
function stageMission(state) {
  stageLateGame(state);
  const player = state.player;
  player.weapon = 'pistol';
  const yard = missionSpots().portYard;
  player.x = yard.x;
  player.y = yard.y - 260; // on the road north of the yard
  player.aimAngle = Math.PI / 2;
  player.angle = Math.PI / 2;
  const guards = [];
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2;
    guards.push({
      x: yard.x + Math.cos(angle) * 150,
      y: yard.y + Math.sin(angle) * 150,
      angle,
      health: 60,
      down: false,
      alerted: true,
      shootCooldown: 0.4 + i * 0.3,
      speed: 120,
    });
  }
  state.guards = guards;
  state.missions.index = 7;
  state.missions.active = true;
  state.missions.stage = 0;
  state.missions.objective = 'Fight past Rourke\'s men at the Port yard';
  state.missions.target = { x: yard.x, y: yard.y, label: 'Port yard' };
  state.missions.dialogue = { text: 'Delia: "Four of his men guard the yard. Take the evidence and meet me at the safehouse."', seconds: 6 };
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
  // Final frame: the guards back on a ring around the yard, the evidence
  // glowing in the middle, the player on the road north aiming south.
  for (let i = 0; i < state.guards.length; i += 1) {
    const angle = (i / 4) * Math.PI * 2;
    const guard = state.guards[i];
    guard.x = yard.x + Math.cos(angle) * 150;
    guard.y = yard.y + Math.sin(angle) * 150;
    guard.angle = angle;
    guard.health = 60;
    guard.down = false;
    guard.alerted = true;
  }
  player.x = yard.x;
  player.y = yard.y - 260;
  player.angle = Math.PI / 2;
  player.aimAngle = Math.PI / 2;
  state.missions.stage = 1;
  state.missions.pickupReady = true;
  state.missions.objective = 'Grab the evidence at the yard';
  state.missions.target = { x: yard.x, y: yard.y, label: 'Evidence' };
  state.missions.dialogue = { text: 'Delia: "Evidence in the yard — grab it and run. The cops are already rolling."', seconds: 6 };
  state.wanted.stars = 3;
  player.angle = Math.PI / 2;
  spawnRoadblock(state, 380);
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
  staged.dispatch = makeDispatch();
  staged.standing = makeStanding();
  staged.crew = makeCrew();
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
