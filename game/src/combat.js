// Combat: bullets, punches and the damage they do. One job: resolve a
// shot or a swing against everyone in the world.
import { PLAYER, CAR, WANTED } from './config.js';
import { distance } from './random.js';
import { hitsSolid } from './city.js';
import { addWanted } from './police.js';
import { addParticles } from './particles.js';
import { scarePedestrians } from './pedestrians.js';
import { playCrash, playWasted } from './audio.js';
import { wreckCar } from './vehicles.js';

// Step every bullet; walls stop them, cars and people take the hit.
export function updateBullets(state, dt) {
  const bullets = state.bullets;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || hitsSolid(b.x, b.y, 2);
    if (!dead) {
      // Hit a pedestrian or a cop?
      for (const ped of state.peds) {
        if (ped.down) continue;
        if (distance(b.x, b.y, ped.x, ped.y) < 16) {
          hurtPedestrian(state, ped, b.damage, b.from);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const guard of state.guards) {
        if (guard.down) continue;
        if (distance(b.x, b.y, guard.x, guard.y) < 16) {
          hurtGuard(state, guard, b.damage, b.from);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      // Hit a car? (A wrecked car does not count.)
      for (const car of state.cars) {
        if (car.wrecked) continue;
        const localX = (b.x - car.x) * Math.cos(-car.angle) - (b.y - car.y) * Math.sin(-car.angle);
        const localY = (b.x - car.x) * Math.sin(-car.angle) + (b.y - car.y) * Math.cos(-car.angle);
        if (Math.abs(localX) < CAR.length / 2 && Math.abs(localY) < CAR.width / 2) {
          car.health -= b.damage;
          addParticles(state, 'spark', b.x, b.y, 5);
          if (car.health <= 0) wreckCar(car, state);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from !== 'player') {
      // An enemy bullet reaching the player.
      const player = state.player;
      if (player.onFoot && distance(b.x, b.y, player.x, player.y) < 16) {
        hurtPlayer(state, b.damage);
        dead = true;
      } else if (!player.onFoot && player.car && distance(b.x, b.y, player.car.x, player.car.y) < CAR.length / 2) {
        player.car.health -= b.damage;
        dead = true;
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

// A fist swing: hurt the closest person or guard in front of the player.
export function resolvePunch(state, player) {
  const reach = PLAYER.punchRange + 14;
  let best = null;
  let bestDist = reach;
  const consider = (target, kind) => {
    const d = distance(player.x, player.y, target.x, target.y);
    if (d < bestDist) {
      bestDist = d;
      best = { target, kind };
    }
  };
  for (const ped of state.peds) if (!ped.down) consider(ped, 'ped');
  for (const guard of state.guards) if (!guard.down) consider(guard, 'guard');
  if (!best) return;
  const angleTo = Math.atan2(best.target.y - player.y, best.target.x - player.x);
  let delta = angleTo - player.aimAngle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) > 1.1) return; // must be roughly facing the target
  if (best.kind === 'ped') hurtPedestrian(state, best.target, PLAYER.punchDamage, 'player');
  else hurtGuard(state, best.target, PLAYER.punchDamage, 'player');
}

export function hurtPedestrian(state, ped, damage, from) {
  ped.down = true;
  ped.state = 'down';
  addParticles(state, 'blood', ped.x, ped.y, 8);
  scarePedestrians(state, ped.x, ped.y);
  if (from === 'player') {
    addWanted(state, WANTED.killPedestrian, 'a bystander was killed');
    state.stats.kills += 1;
  }
}

export function hurtGuard(state, guard, damage, from) {
  guard.health -= damage;
  addParticles(state, 'blood', guard.x, guard.y, 6);
  if (guard.health <= 0) {
    guard.down = true;
    state.stats.kills += 1;
    if (from === 'player') addWanted(state, 1, 'a guard was killed');
    if (state.missions) state.missions.onGuardDown(state);
  } else {
    // The guard turns to face the shooter.
    guard.alerted = true;
  }
}

// A cop or guard fires at the player. Returns a bullet or null.
export function enemyShoot(shooter, state) {
  const player = state.player;
  const tx = player.car ? player.car.x : player.x;
  const ty = player.car ? player.car.y : player.y;
  const angle = Math.atan2(ty - shooter.y, tx - shooter.x);
  const spread = (state.rng() - 0.5) * 0.22;
  return {
    x: shooter.x + Math.cos(angle) * 20,
    y: shooter.y + Math.sin(angle) * 20,
    vx: Math.cos(angle + spread) * PLAYER.bulletSpeed * 0.85,
    vy: Math.sin(angle + spread) * PLAYER.bulletSpeed * 0.85,
    life: 0.8,
    damage: 9,
    from: 'enemy',
  };
}

export function hurtPlayer(state, damage) {
  const player = state.player;
  player.health = Math.max(0, player.health - damage);
  player.hurtFlash = 0.35;
  if (player.health <= 0 && state.screen === 'play') {
    state.screen = 'wasted';
    playWasted();
  }
}

// A moving car running over a pedestrian.
export function carHitsPedestrian(state, car, ped) {
  if (ped.down || car.speed < 60) return;
  ped.down = true;
  ped.state = 'down';
  addParticles(state, 'blood', ped.x, ped.y, 8);
  scarePedestrians(state, ped.x, ped.y);
  playCrash(0.6);
  if (car.driver === 'player') {
    addWanted(state, WANTED.hitPedestrian, 'a pedestrian was hit');
    state.stats.kills += 1;
  }
}
