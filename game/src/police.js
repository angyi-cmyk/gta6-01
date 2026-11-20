// The wanted level and the police who answer it. One job: make crime feel
// risky, and make the heat die down when the player lays low.
import { POLICE, CAR, WANTED, PALETTE } from './config.js';
import { makeRng, clamp, angleDelta, distance, range } from './random.js';
import { randomRoadPoint, resolveSolid } from './city.js';
import { makeCar } from './vehicles.js';
import { playCrash } from './audio.js';

export function makeWanted() {
  return {
    stars: 0,
    heat: 0, // 0..1 progress toward the next star while committing crimes
    quietTimer: 0, // seconds without crime and without police nearby
    bustTimer: 0, // how long a cruiser has held the player car at low speed
    lastCrimeAt: -100,
  };
}

export function addWanted(state, stars, reason) {
  const wanted = state.wanted;
  wanted.stars = clamp(wanted.stars + stars, 0, 5);
  wanted.quietTimer = 0;
  wanted.lastCrimeAt = state.time;
  if (state.log) state.log(`Wanted +${stars} — ${reason}`);
}

export function wantedCarCount(stars) {
  return stars === 0 ? 0 : Math.min(POLICE.maxCars, stars + (stars >= 3 ? 1 : 0));
}

// Spawn a police cruiser on a road away from the player.
export function spawnPoliceCar(state) {
  const rng = state.rng;
  let p = randomRoadPoint(rng);
  let tries = 0;
  while (distance(p.x, p.y, state.player.x, state.player.y) < 700 && tries < 12) {
    p = randomRoadPoint(rng);
    tries += 1;
  }
  const angle = Math.atan2(state.player.y - p.y, state.player.x - p.x);
  const car = makeCar(p.x, p.y, angle, {
    type: 'police',
    driver: 'police',
    color: PALETTE.policeCar,
    topSpeed: POLICE.chaseSpeed,
  });
  state.cars.push(car);
  return car;
}

// A cruiser steers at the player, rams, and tries to pin the player's car.
// On foot, a nearby cruiser drops a cop who chases on foot instead.
export function updatePoliceCar(car, state, dt) {
  if (car.wrecked) return;
  const player = state.player;
  const targetX = player.car ? player.car.x : player.x;
  const targetY = player.car ? player.car.y : player.y;
  const dx = targetX - car.x;
  const dy = targetY - car.y;
  const dist = Math.hypot(dx, dy);
  const wantAngle = Math.atan2(dy, dx);
  const delta = angleDelta(car.angle, wantAngle);
  const steer = clamp(delta * 1.6, -1, 1);
  // Reverse out when jammed against a wall.
  if (car.stuckTimer > 0) {
    car.stuckTimer -= dt;
    car.vx = Math.cos(car.angle) * -140;
    car.vy = Math.sin(car.angle) * -140;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    return;
  }
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const forwardSpeed = car.vx * forwardX + car.vy * forwardY;
  car.angle += steer * 2.8 * dt * (forwardSpeed >= 0 ? 1 : -1);
  const accel = dist > 120 ? CAR.accel : CAR.accel * 0.4;
  const newForward = Math.min(forwardSpeed + accel * dt, car.topSpeed);
  const rightX = -forwardY;
  const rightY = forwardX;
  const lateral = (car.vx * rightX + car.vy * rightY) * Math.max(0, 1 - 3.4 * dt);
  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  car.vx = nx * newForward + -ny * lateral;
  car.vy = ny * newForward + nx * lateral;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = Math.hypot(car.vx, car.vy);
  // Wall scrape: lose speed and back out for a moment.
  const solved = resolveSolid(car.x, car.y, CAR.length / 2 - 4);
  if (solved.pushed) {
    if (car.speed > 80) playCrash(0.7);
    car.x = solved.x;
    car.y = solved.y;
    car.vx *= -0.2;
    car.vy *= -0.2;
    car.stuckTimer = 0.7;
  }
}

// Keep the number of active cruisers matched to the wanted level.
export function balancePolice(state) {
  const wantedCount = wantedCarCount(state.wanted.stars);
  const police = state.cars.filter((c) => c.type === 'police' && !c.wrecked);
  if (police.length < wantedCount) {
    spawnPoliceCar(state);
  } else if (police.length > wantedCount) {
    // Extra cruisers give up and drive off (removed when far away).
    const extra = police[police.length - 1];
    extra.driver = 'traffic';
    extra.type = 'traffic';
  }
}

// Heat decays: one star per cooldown while the player commits no crime and
// no police car is near. Returns true when a star just dropped.
export function decayWanted(state, dt) {
  const wanted = state.wanted;
  if (wanted.stars === 0) return false;
  const policeNear = state.cars.some(
    (c) => c.type === 'police' && !c.wrecked && distance(c.x, c.y, state.player.x, state.player.y) < 420,
  );
  const crimeRecently = state.time - wanted.lastCrimeAt < 6;
  if (policeNear || crimeRecently) {
    wanted.quietTimer = 0;
    return false;
  }
  wanted.quietTimer += dt;
  if (wanted.quietTimer >= POLICE.cooldownPerStar) {
    wanted.quietTimer = 0;
    wanted.stars -= 1;
    return true;
  }
  return false;
}

// BUSTED: a cruiser has held the player's car still for long enough.
export function checkBusted(state, dt) {
  const wanted = state.wanted;
  const player = state.player;
  if (!player.car || wanted.stars === 0) {
    wanted.bustTimer = 0;
    return false;
  }
  const held = state.cars.some(
    (c) => c.type === 'police' && !c.wrecked
      && distance(c.x, c.y, player.car.x, player.car.y) < 90
      && player.car.speed < 25,
  );
  if (held) {
    wanted.bustTimer += dt;
    return wanted.bustTimer >= POLICE.bustHoldSeconds;
  }
  wanted.bustTimer = 0;
  return false;
}
