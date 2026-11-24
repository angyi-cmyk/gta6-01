// The player, on foot and behind the wheel. One job: turn input into a body
// that moves, drives, steals cars and fights.
import { PLAYER, CAR, WORLD } from './config.js';
import { clamp, angleDelta, distance } from './random.js';
import { resolveSolid } from './city.js';
import { playGunshot, playPunch } from './audio.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2, // facing up (north) at spawn
    aimAngle: -Math.PI / 2,
    speed: 0,
    health: PLAYER.maxHealth,
    money: 120,
    weapon: 'fists', // 'fists' or 'pistol'
    onFoot: true,
    car: null, // the car the player is driving, when any
    attackCooldown: 0,
    hurtFlash: 0,
    carsStolen: 0,
    missionsDone: 0,
    walkPhase: 0, // walk-cycle phase, advanced on foot; the 3D figure bobs on it
  };
}

// Aim at the mouse: the screen position converts through the camera.
export function updateAim(player, camera, mouseX, mouseY) {
  const worldX = camera.x + mouseX;
  const worldY = camera.y + mouseY;
  player.aimAngle = Math.atan2(worldY - player.y, worldX - player.x);
}

// Walk or run on foot. Returns nothing; mutates the player.
export function updateOnFoot(player, move, dt, running) {
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const targetX = move.x * speed;
  const targetY = move.y * speed;
  // Snappy acceleration: the player stops and starts fast.
  player.x += targetX * dt;
  player.y += targetY * dt;
  player.speed = Math.hypot(targetX, targetY);
  if (player.speed > 4) {
    player.angle = Math.atan2(targetY, targetX);
    player.walkPhase = (player.walkPhase || 0) + player.speed * dt * 0.045;
  }
  const solved = resolveSolid(player.x, player.y, PLAYER.radius);
  player.x = solved.x;
  player.y = solved.y;
  if (player.attackCooldown > 0) player.attackCooldown -= dt;
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
}

// Arcade car physics: accelerate, steer, drift. The car is a velocity vector
// split into forward and lateral parts; grip kills the lateral part, the
// handbrake kills the grip. Returns true when the car scraped a wall.
export function updateDriving(car, steer, throttle, handbrake, dt) {
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const rightX = -forwardY;
  const rightY = forwardX;
  const forwardSpeed = car.vx * forwardX + car.vy * forwardY;
  const lateralSpeed = car.vx * rightX + car.vy * rightY;
  // Steering only bites while moving, and more at low speed.
  const steerAuthority = clamp(Math.abs(forwardSpeed) / 120, 0, 1) * 2.6;
  car.angle += steer * steerAuthority * dt * (forwardSpeed >= 0 ? 1 : -1);
  let newForward = forwardSpeed + throttle * CAR.accel * dt;
  if (throttle < 0) newForward = Math.max(newForward, -CAR.reverseTop);
  if (throttle > 0) newForward = Math.min(newForward, car.topSpeed);
  if (throttle === 0) newForward *= Math.max(0, 1 - 0.6 * dt); // coast down
  const grip = handbrake ? CAR.handbrakeGrip : CAR.grip;
  const newLateral = lateralSpeed * Math.max(0, 1 - grip * dt);
  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  car.vx = nx * newForward + -ny * newLateral;
  car.vy = ny * newForward + nx * newLateral;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = Math.hypot(car.vx, car.vy);
  const solved = resolveSolid(car.x, car.y, CAR.length / 2 - 4);
  let scraped = false;
  if (solved.pushed) {
    scraped = car.speed > 60;
    // Kill the velocity component that drove into the wall.
    if (solved.x !== car.x) car.vx *= -0.25;
    if (solved.y !== car.y) car.vy *= -0.25;
    car.x = solved.x;
    car.y = solved.y;
    car.speed = Math.hypot(car.vx, car.vy);
  }
  return scraped;
}

// The nearest car the player can steal (within reach, not wrecked).
export function nearestStealableCar(player, cars) {
  let best = null;
  let bestDist = 70;
  for (const car of cars) {
    if (car.wrecked || car === player.car) continue;
    const d = distance(player.x, player.y, car.x, car.y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(player, car) {
  player.car = car;
  player.onFoot = false;
  car.driver = 'player';
  car.passenger = null;
  player.x = car.x;
  player.y = car.y;
}

export function exitCar(player) {
  if (!player.car) return;
  const car = player.car;
  car.driver = 'none';
  // Step out to the side of the car, clear of walls.
  const sideX = car.x - Math.sin(car.angle) * 34;
  const sideY = car.y + Math.cos(car.angle) * 34;
  const solved = resolveSolid(sideX, sideY, PLAYER.radius);
  player.x = solved.x;
  player.y = solved.y;
  player.angle = car.angle;
  player.car = null;
  player.onFoot = true;
}

// Attack with the current weapon. Returns a bullet object when the player
// fires the pistol, or 'punch' when the player swings fists.
export function attack(player, state) {
  if (player.attackCooldown > 0 || !player.onFoot) return null;
  if (player.weapon === 'pistol') {
    player.attackCooldown = PLAYER.shotCooldown;
    playGunshot();
    return {
      x: player.x + Math.cos(player.aimAngle) * 20,
      y: player.y + Math.sin(player.aimAngle) * 20,
      vx: Math.cos(player.aimAngle) * PLAYER.bulletSpeed,
      vy: Math.sin(player.aimAngle) * PLAYER.bulletSpeed,
      life: 0.9,
      damage: PLAYER.shotDamage,
      from: 'player',
    };
  }
  player.attackCooldown = PLAYER.punchCooldown;
  playPunch();
  return 'punch';
}

export function damagePlayer(player, amount) {
  player.health = Math.max(0, player.health - amount);
  player.hurtFlash = 0.35;
  return player.health <= 0;
}
