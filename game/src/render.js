// Drawing the world: the city, the cars, the people, the effects. One job:
// turn the game state into a frame the player (and the judge) can read.
import { WORLD, VIEW, PALETTE, CAR, PLAYER } from './config.js';
import { CITY, ROAD_LINES, BEACH_TOP, WATER_TOP, isSand } from './city.js';
import { clamp } from './random.js';

const ROAD_HALF = WORLD.roadWidth / 2;

export function makeCamera() {
  return { x: 0, y: 0, zoom: 1 };
}

// Follow the player smoothly, clamped to the world.
export function updateCamera(camera, targetX, targetY, dt) {
  const viewW = VIEW.width / camera.zoom;
  const viewH = VIEW.height / camera.zoom;
  const wantX = clamp(targetX - viewW / 2, 0, WORLD.size - viewW);
  const wantY = clamp(targetY - viewH / 2, 0, WORLD.size - viewH);
  const t = Math.min(1, dt * 4.5);
  camera.x += (wantX - camera.x) * t;
  camera.y += (wantY - camera.y) * t;
}

function drawGround(ctx, camera) {
  const x0 = Math.max(0, camera.x - 40);
  const y0 = Math.max(0, camera.y - 40);
  const x1 = Math.min(WORLD.size, camera.x + VIEW.width + 40);
  const y1 = Math.min(WORLD.size, camera.y + VIEW.height + 40);
  // Grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Dry patches for a sun-baked feel.
  ctx.fillStyle = PALETTE.grassDry;
  const patch = 260;
  for (let gx = Math.floor(x0 / patch) * patch; gx < x1; gx += patch) {
    for (let gy = Math.floor(y0 / patch) * patch; gy < y1; gy += patch) {
      if ((gx * 7 + gy * 13) % 5 === 0) ctx.fillRect(gx + 20, gy + 30, 150, 90);
    }
  }
  // Beach sand and water along the south edge.
  if (y1 > BEACH_TOP) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(x0, Math.max(y0, BEACH_TOP), x1 - x0, Math.min(y1, WATER_TOP) - Math.max(y0, BEACH_TOP));
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, Math.max(y0, WATER_TOP), x1 - x0, y1 - Math.max(y0, WATER_TOP));
    ctx.fillStyle = PALETTE.waterDeep;
    for (let wx = Math.floor(x0 / 180) * 180; wx < x1; wx += 180) {
      ctx.fillRect(wx, Math.max(y0, WATER_TOP) + 26, 120, 4);
      ctx.fillRect(wx + 60, Math.max(y0, WATER_TOP) + 62, 100, 4);
    }
  }
}

function drawRoads(ctx, camera) {
  const x0 = camera.x - 40;
  const x1 = camera.x + VIEW.width + 40;
  const y0 = camera.y - 40;
  const y1 = camera.y + VIEW.height + 40;
  ctx.fillStyle = PALETTE.road;
  for (const line of ROAD_LINES) {
    if (line > y0 - ROAD_HALF && line < y1 + ROAD_HALF) ctx.fillRect(x0, line - ROAD_HALF, x1 - x0, WORLD.roadWidth);
    if (line > x0 - ROAD_HALF && line < x1 + ROAD_HALF) ctx.fillRect(line - ROAD_HALF, y0, WORLD.roadWidth, y1 - y0);
  }
  // Sidewalks.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const line of ROAD_LINES) {
    if (line > y0 - ROAD_HALF - WORLD.sidewalk && line < y1 + ROAD_HALF + WORLD.sidewalk) {
      ctx.fillRect(x0, line - ROAD_HALF - WORLD.sidewalk, x1 - x0, WORLD.sidewalk);
      ctx.fillRect(x0, line + ROAD_HALF, x1 - x0, WORLD.sidewalk);
    }
    if (line > x0 - ROAD_HALF - WORLD.sidewalk && line < x1 + ROAD_HALF + WORLD.sidewalk) {
      ctx.fillRect(line - ROAD_HALF - WORLD.sidewalk, y0, WORLD.sidewalk, y1 - y0);
      ctx.fillRect(line + ROAD_HALF, y0, WORLD.sidewalk, y1 - y0);
    }
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.lane;
  for (const line of ROAD_LINES) {
    if (line > y0 && line < y1) {
      for (let dx = Math.floor(x0 / 64) * 64; dx < x1; dx += 64) ctx.fillRect(dx, line - 2, 30, 4);
    }
    if (line > x0 && line < x1) {
      for (let dy = Math.floor(y0 / 64) * 64; dy < y1; dy += 64) ctx.fillRect(line - 2, dy, 4, 30);
    }
  }
}

function drawBuildings(ctx, camera, target) {
  const x0 = camera.x - 60;
  const x1 = camera.x + VIEW.width + 60;
  const y0 = camera.y - 60;
  const y1 = camera.y + VIEW.height + 60;
  // Port containers.
  for (const c of CITY.containers) {
    if (c.x > x1 || c.x + c.w < x0 || c.y > y1 || c.y + c.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(c.x + 4, c.y + 5, c.w, c.h);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(c.x, c.y, c.w, 5);
  }
  // Park grass and trees.
  ctx.fillStyle = PALETTE.park;
  ctx.fillRect(1125 + ROAD_HALF + WORLD.blockMargin, 1125 + ROAD_HALF + WORLD.blockMargin, 450 - 2 * (ROAD_HALF + WORLD.blockMargin), 450 - 2 * (ROAD_HALF + WORLD.blockMargin));
  for (const b of CITY.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    // Shadow, then walls, then the roof.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
    }
    // The name, unless the mission target ring already labels this building.
    const targetHere = target && target.x > b.x && target.x < b.x + b.w && target.y > b.y && target.y < b.y + b.h;
    if (b.name && !targetHere) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
  }
  // Trees.
  for (const t of CITY.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const halfL = CAR.length / 2;
  const halfW = CAR.width / 2;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-halfL + 3, -halfW + 4, CAR.length, CAR.width);
  // Body.
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  roundRect(ctx, -halfL, -halfW, CAR.length, CAR.width, 8);
  ctx.fill();
  if (!car.wrecked) {
    // Windshield and rear window.
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    ctx.fillRect(halfL - 18, -halfW + 4, 10, CAR.width - 8);
    ctx.fillRect(-halfL + 8, -halfW + 4, 8, CAR.width - 8);
    // Headlights.
    ctx.fillStyle = '#fff8c8';
    ctx.fillRect(halfL - 2, -halfW + 3, 3, 5);
    ctx.fillRect(halfL - 2, halfW - 8, 3, 5);
    if (car.type === 'police') {
      // Light bar, flashing red and blue.
      const phase = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2d2d' : '#2d5bff';
      ctx.fillRect(-6, -halfW + 2, 12, 8);
      ctx.fillStyle = phase ? '#2d5bff' : '#ff2d2d';
      ctx.fillRect(-6, halfW - 10, 12, 8);
      ctx.fillStyle = '#101418';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 3);
    }
    if (car.type === 'mission') {
      ctx.fillStyle = '#101418';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('COMET', 0, 3);
    }
  } else {
    // Wreck smoke puffs are particles; the body just looks burnt.
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(-halfL + 6, -halfW + 5, 12, 6);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, skin, shirt, down, isPlayer, isGuard) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    // Lying flat.
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(12, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * 4, Math.sin(angle) * 4, 6, 0, Math.PI * 2);
  ctx.fill();
  if (isGuard) {
    // A guard's cap and gun.
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(-2, -8, 12, 4);
    ctx.fillStyle = '#222';
    ctx.fillRect(Math.cos(angle) * 10, Math.sin(angle) * 10 - 2, 8, 4);
  }
  if (isPlayer) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, state, camera) {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawGround(ctx, camera);
  drawRoads(ctx, camera);
  drawBuildings(ctx, camera, state.missions.target);
  // Skid marks.
  for (const skid of state.particles.skids) {
    ctx.save();
    ctx.translate(skid.x, skid.y);
    ctx.rotate(skid.angle);
    ctx.fillStyle = `rgba(20,20,20,${0.35 * (skid.life / 6)})`;
    ctx.fillRect(-14, -3, 28, 6);
    ctx.restore();
  }
  // Mission target marker: a pulsing ring on the ground.
  if (state.missions.target) {
    const t = state.missions.target;
    const pulse = 1 + 0.12 * Math.sin(state.time * 5);
    ctx.strokeStyle = '#ffd23d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.label, t.x, t.y - 44);
  }
  // Mission start blip when no mission is active.
  if (!state.missions.active && state.missions.index < 3 && state.missionStart) {
    const s = state.missionStart;
    const pulse = 1 + 0.15 * Math.sin(state.time * 5);
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('M', s.x, s.y + 9 * pulse);
    ctx.strokeStyle = '#ffd23d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 20 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Ledger / package pickup glow.
  if (state.missions.pickupReady && state.missions.target) {
    const t = state.missions.target;
    ctx.fillStyle = '#7dff8a';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 10 + 3 * Math.sin(state.time * 6), 0, Math.PI * 2);
    ctx.fill();
  }
  // Cars, sorted so wrecks draw under moving cars.
  const cars = [...state.cars].sort((a, b) => (a.wrecked ? 1 : 0) - (b.wrecked ? 1 : 0));
  for (const car of cars) drawCar(ctx, car, state.time);
  // Pedestrians and guards.
  for (const ped of state.peds) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.skin, ped.shirt, ped.down, false, false);
  for (const guard of state.guards) {
    if (guard.down) drawPerson(ctx, guard.x, guard.y, guard.angle, '#e8b98a', '#3a3a3a', true, false, true);
    else drawPerson(ctx, guard.x, guard.y, guard.angle, '#e8b98a', '#3a3a3a', false, false, true);
  }
  // The player (on foot only; in a car the car is the player).
  const player = state.player;
  if (player.onFoot) {
    drawPerson(ctx, player.x, player.y, player.aimAngle, '#e8b98a', PALETTE.car[0], false, true, false);
    // Aim line and crosshair when armed.
    if (player.weapon === 'pistol') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(player.x + Math.cos(player.aimAngle) * 46, player.y + Math.sin(player.aimAngle) * 46);
      ctx.stroke();
    }
  }
  // Bullets.
  ctx.fillStyle = '#ffe14d';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Particles.
  for (const p of state.particles.list) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
