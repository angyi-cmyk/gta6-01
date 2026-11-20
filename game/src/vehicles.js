// Cars: traffic that drives the roads, the player's ride, police cruisers and
// mission cars. One job: move cars, keep them on the road, and crash them.
import { CAR, TRAFFIC, PALETTE, WORLD } from './config.js';
import { makeRng, pick, range, rangeInt, clamp, angleDelta, distance } from './random.js';
import { nearestRoadLine, onRoadAxis, randomRoadPoint, isRoadPoint } from './city.js';
import { updateDriving } from './player.js';

let nextCarId = 1;

export function makeCar(x, y, angle, options = {}) {
  return {
    id: nextCarId,
    x, y,
    angle,
    vx: 0, vy: 0,
    speed: 0,
    color: options.color || pick(makeRng(nextCarId * 7919), PALETTE.car),
    type: options.type || 'traffic', // traffic | police | mission | player
    driver: options.driver || 'traffic', // traffic | police | player | none
    topSpeed: options.topSpeed || 330,
    health: CAR.maxHealth,
    wrecked: false,
    // Traffic AI: which road axis it follows and which way along it.
    axis: options.axis || 'x',
    direction: options.direction || 1,
    cruise: options.cruise || range(makeRng(nextCarId * 104729), TRAFFIC.speedMin, TRAFFIC.speedMax),
    stuckTimer: 0,
    smokeTimer: 0,
    lastHitAt: -99, // seconds (state.time) of the last crash that hurt this car
  };
}

export function resetCarIds() {
  nextCarId = 1;
}

// Spawn traffic on roads, never right on top of the player.
export function spawnTraffic(state, count) {
  const rng = state.rng;
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 12) {
    tries += 1;
    const p = randomRoadPoint(rng);
    if (distance(p.x, p.y, state.player.x, state.player.y) < TRAFFIC.spawnSafeRadius) continue;
    const horizontal = Math.abs(p.y - nearestRoadLine(p.y)) < 4;
    const axis = horizontal ? 'x' : 'y';
    const direction = rng() < 0.5 ? 1 : -1;
    const angle = axis === 'x' ? (direction > 0 ? 0 : Math.PI) : (direction > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(p.x, p.y, angle, { axis, direction });
    state.cars.push(car);
    placed += 1;
  }
}

// A traffic car drives along its road; at an intersection it may turn. It
// slows for the car ahead on the same road.
export function updateTrafficCar(car, state, dt) {
  if (car.wrecked) return;
  const axis = car.axis;
  const pos = axis === 'x' ? car.x : car.y;
  const line = axis === 'x' ? car.y : car.x;
  // Stay glued to the road centre line.
  const targetLine = nearestRoadLine(line);
  const lineError = targetLine - line;
  const steer = clamp(lineError * 0.02, -1, 1);
  // Is there a car ahead on this road?
  let ahead = null;
  let aheadDist = Infinity;
  for (const other of state.cars) {
    if (other === car || other.wrecked || other.axis !== axis) continue;
    const otherPos = axis === 'x' ? other.x : other.y;
    const otherLine = axis === 'x' ? other.y : other.x;
    if (Math.abs(otherLine - targetLine) > 60) continue;
    const along = (otherPos - pos) * car.direction;
    if (along > 0 && along < aheadDist) {
      aheadDist = along;
      ahead = other;
    }
  }
  let throttle = 1;
  if (ahead && aheadDist < 95) throttle = aheadDist < 55 ? -0.6 : 0.15;
  // At an intersection, sometimes turn onto the crossing road.
  const onIntersection = onRoadAxis(pos) && onRoadAxis(line);
  if (onIntersection && state.rng() < 0.35 * dt) {
    const turn = state.rng();
    if (turn < 0.3) {
      // Turn left or right onto the crossing road.
      const newAxis = axis === 'x' ? 'y' : 'x';
      const newDirection = state.rng() < 0.5 ? 1 : -1;
      car.axis = newAxis;
      car.direction = newDirection;
      car.angle = newAxis === 'x' ? (newDirection > 0 ? 0 : Math.PI) : (newDirection > 0 ? Math.PI / 2 : -Math.PI / 2);
      car.vx = 0;
      car.vy = 0;
    }
  }
  // Traffic cars drive straight: steer toward their heading, throttle as set.
  const targetAngle = car.axis === 'x' ? (car.direction > 0 ? 0 : Math.PI) : (car.direction > 0 ? Math.PI / 2 : -Math.PI / 2);
  const delta = angleDelta(car.angle, targetAngle);
  car.angle += clamp(delta, -2.4 * dt, 2.4 * dt) + steer * 0.4 * dt;
  const forward = Math.cos(car.angle);
  const sideways = Math.sin(car.angle);
  const speed = Math.min(car.cruise, throttle < 0 ? 0 : car.cruise * throttle);
  car.vx = forward * speed;
  car.vy = sideways * speed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = Math.hypot(car.vx, car.vy);
  // Keep traffic inside the world; bounce it back at the edge.
  if (car.x < 60 || car.x > WORLD.size - 60 || car.y < 60 || car.y > WORLD.size - 60) {
    car.direction *= -1;
    car.angle += Math.PI;
    car.x = clamp(car.x, 60, WORLD.size - 60);
    car.y = clamp(car.y, 60, WORLD.size - 60);
  }
}

// Push two overlapping cars apart and trade some speed; the harder the hit,
// the more damage and the more smoke. Returns the impact speed.
export function collideCars(a, b, state) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const minDist = CAR.length - 6;
  if (dist >= minDist) return 0;
  const overlap = minDist - dist;
  const nx = dx / dist;
  const ny = dy / dist;
  const aMoving = a.driver !== 'none' || a.speed > 5;
  const bMoving = b.driver !== 'none' || b.speed > 5;
  if (aMoving && bMoving) {
    a.x -= nx * overlap / 2;
    a.y -= ny * overlap / 2;
    b.x += nx * overlap / 2;
    b.y += ny * overlap / 2;
  } else if (aMoving) {
    a.x -= nx * overlap;
    a.y -= ny * overlap;
  } else {
    b.x += nx * overlap;
    b.y += ny * overlap;
  }
  const relSpeed = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
  if (relSpeed > 40) {
    // Crash damage is small and rate-limited, so one pile-up cannot drain a
    // car in a second: arcade driving should forgive a scrape.
    const now = state ? state.time : 0;
    const damage = Math.min(6, relSpeed * 0.015);
    if (now - (a.lastHitAt || -99) >= 0.4) {
      a.health -= damage;
      a.lastHitAt = now;
    }
    if (now - (b.lastHitAt || -99) >= 0.4) {
      b.health -= damage;
      b.lastHitAt = now;
    }
    a.vx *= 0.55;
    a.vy *= 0.55;
    b.vx *= 0.55;
    b.vy *= 0.55;
    if (a.health <= 0) wreckCar(a, state);
    if (b.health <= 0) wreckCar(b, state);
    return relSpeed;
  }
  return 0;
}

export function wreckCar(car, state) {
  car.wrecked = true;
  car.vx = 0;
  car.vy = 0;
  car.speed = 0;
  car.driver = 'none';
  if (state && state.addParticles) {
    state.addParticles('explosion', car.x, car.y, 26);
  }
}

// A car is drivable when it is not wrecked.
export function isDrivable(car) {
  return car && !car.wrecked;
}

// Keep the traffic population topped up as cars get stolen or wrecked.
export function topUpTraffic(state) {
  const traffic = state.cars.filter((c) => c.type === 'traffic' && !c.wrecked).length;
  if (traffic < TRAFFIC.count) spawnTraffic(state, TRAFFIC.count - traffic);
}
