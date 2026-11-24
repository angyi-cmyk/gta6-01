// Pedestrians: people walking the sidewalks, running from danger. One job:
// make the city feel inhabited.
import { PEDESTRIANS, PALETTE } from './config.js';
import { makeRng, pick, range, clamp, distance } from './random.js';
import { randomSidewalkPoint, nearestRoadLine, resolveSolid, isRoadPoint } from './city.js';

let nextPedId = 1;

export function makePedestrian(x, y, rng) {
  // The id must be unique per pedestrian: the 3D renderer pools figures
  // by id, and two people sharing one id would draw as one person.
  const id = nextPedId;
  nextPedId += 1;
  return {
    id,
    x, y,
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, PEDESTRIANS.walkMin, PEDESTRIANS.walkMax),
    state: 'walk', // walk | flee | down
    skin: pick(rng, PALETTE.ped),
    shirt: pick(rng, PALETTE.shirt),
    fearTimer: 0,
    targetX: x,
    targetY: y,
    retargetTimer: range(rng, 0, 4),
    down: false,
    walkPhase: range(rng, 0, Math.PI * 2), // walk-cycle phase; the 3D figure bobs on it
  };
}

export function resetPedIds() {
  nextPedId = 1;
}

export function spawnPedestrians(state, count) {
  const rng = state.rng;
  for (let i = 0; i < count; i += 1) {
    const p = randomSidewalkPoint(rng);
    if (distance(p.x, p.y, state.player.x, state.player.y) < 220) continue;
    state.peds.push(makePedestrian(p.x, p.y, rng));
  }
}

// A pedestrian walks along sidewalks; when scared it runs away from the
// danger point. `danger` is {x, y} or null.
export function updatePedestrian(ped, state, dt, danger) {
  if (ped.down) return;
  if (danger) {
    const d = distance(ped.x, ped.y, danger.x, danger.y);
    if (d < 320) {
      ped.state = 'flee';
      ped.fearTimer = 2.5;
    }
  }
  if (ped.fearTimer > 0) {
    ped.fearTimer -= dt;
    if (ped.fearTimer <= 0) ped.state = 'walk';
  }
  // Fleeing needs a danger point to run from. The danger only exists while
  // a bullet is flying, but a scared pedestrian keeps fleeing for 2.5 s —
  // once the bullet is gone there is nothing to run from, so calm down
  // instead of crashing on a null danger.
  if (ped.state === 'flee' && !danger) ped.state = 'walk';
  if (ped.state === 'flee') {
    const away = Math.atan2(ped.y - danger.y, ped.x - danger.x);
    ped.angle = away;
    const speed = PEDESTRIANS.fleeSpeed;
    ped.x += Math.cos(away) * speed * dt;
    ped.y += Math.sin(away) * speed * dt;
  } else {
    ped.retargetTimer -= dt;
    if (ped.retargetTimer <= 0) {
      ped.retargetTimer = range(state.rng, 3, 8);
      // Walk to a nearby sidewalk point.
      const p = randomSidewalkPoint(state.rng);
      ped.targetX = p.x;
      ped.targetY = p.y;
    }
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 8) {
      ped.angle = Math.atan2(dy, dx);
      ped.x += (dx / dist) * ped.speed * dt;
      ped.y += (dy / dist) * ped.speed * dt;
      ped.walkPhase += ped.speed * dt * 0.045;
    }
  }
  const solved = resolveSolid(ped.x, ped.y, 10);
  ped.x = solved.x;
  ped.y = solved.y;
  // Keep pedestrians out of the water and off the roads' centres when they
  // can help it; they may cross roads at intersections.
  ped.x = clamp(ped.x, 20, 3580);
  ped.y = clamp(ped.y, 20, 3560);
}

export function scarePedestrians(state, x, y, radius = 320) {
  for (const ped of state.peds) {
    if (!ped.down && distance(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.fearTimer = 2.5;
    }
  }
}
