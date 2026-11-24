// The HUD: health, cash, wanted stars, speed, minimap, objectives, dialogue
// and the menus. One job: show the player what is happening, on the canvas so
// screenshots include it.
import { VIEW, WORLD, PALETTE, CAR } from './config.js';
import { ROAD_LINES } from './city.js';
import { hasSave } from './save.js';
import { STORY, MISSION_COUNT } from './missions.js';
import { standingLevel, topDistrict } from './standing.js';
import { formatRaceTime, RACE_START } from './race.js';
import { crewNames } from './crew.js';

const MINIMAP_SIZE = 168;
const MINIMAP_X = 14;
const MINIMAP_Y = VIEW.height - MINIMAP_SIZE - 14;

function drawStars(ctx, stars, x, y) {
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd23d' : 'rgba(255,255,255,0.35)';
    ctx.fillText('★', x + i * 30, y);
  }
}

export function drawMinimap(ctx, state) {
  const scale = MINIMAP_SIZE / WORLD.size;
  const x0 = MINIMAP_X;
  const y0 = MINIMAP_Y;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,18,0.82)';
  ctx.fillRect(x0 - 4, y0 - 4, MINIMAP_SIZE + 8, MINIMAP_SIZE + 8);
  ctx.strokeStyle = '#ffd23d';
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 - 4, y0 - 4, MINIMAP_SIZE + 8, MINIMAP_SIZE + 8);
  // Water at the bottom.
  ctx.fillStyle = '#2f8fae';
  ctx.fillRect(x0, y0 + MINIMAP_SIZE - 6, MINIMAP_SIZE, 6);
  // Roads.
  ctx.strokeStyle = '#8a8a8a';
  ctx.lineWidth = 2;
  for (const line of ROAD_LINES) {
    ctx.beginPath();
    ctx.moveTo(x0 + line * scale, y0);
    ctx.lineTo(x0 + line * scale, y0 + MINIMAP_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + line * scale);
    ctx.lineTo(x0 + MINIMAP_SIZE, y0 + line * scale);
    ctx.stroke();
  }
  const dot = (x, y, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + x * scale, y0 + y * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  if (state.missions.target) dot(state.missions.target.x, state.missions.target.y, '#ffd23d', 5);
  if (!state.missions.active && state.missionStart) dot(state.missionStart.x, state.missionStart.y, '#ffd23d', 5);
  // Street race: the beach start line once the story is done, and the
  // checkpoints still to hit while a race runs.
  if (state.race) {
    if (state.race.active) {
      for (let i = state.race.cpIndex; i < state.race.checkpoints.length; i += 1) {
        dot(state.race.checkpoints[i].x, state.race.checkpoints[i].y, '#b06fd8', 4);
      }
    } else if (state.missions.index >= MISSION_COUNT) {
      dot(RACE_START.x, RACE_START.y, '#b06fd8', 5);
    }
  }
  for (const car of state.cars) {
    if (car.wrecked) continue;
    if (car.type === 'police') dot(car.x, car.y, '#3d7dd9', 3);
    else if (car.type === 'mission') dot(car.x, car.y, '#e8c832', 3);
  }
  // Roadblocks: red squares, so the trap reads on the map too.
  if (state.dispatch) {
    for (const car of state.dispatch.roadblocks) {
      ctx.fillStyle = '#ff2d2d';
      ctx.fillRect(x0 + car.x * scale - 4, y0 + car.y * scale - 4, 8, 8);
    }
  }
  // The player: a white dot with a direction tick.
  const player = state.player;
  dot(player.x, player.y, '#ffffff', 4);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0 + player.x * scale, y0 + player.y * scale);
  ctx.lineTo(x0 + (player.x + Math.cos(player.angle) * 90) * scale, y0 + (player.y + Math.sin(player.angle) * 90) * scale);
  ctx.stroke();
  ctx.restore();
}

export function drawHud(ctx, state) {
  const player = state.player;
  ctx.save();
  ctx.textAlign = 'left';
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, 14, 220, 26);
  ctx.fillStyle = player.health > 30 ? '#7ac74f' : '#d94f3d';
  ctx.fillRect(17, 17, 214 * (player.health / 100), 20);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(player.health)}`, 24, 32);
  // Cash.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, 48, 220, 30);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`$${player.money.toLocaleString('en-US')}`, 24, 69);
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(player.weapon === 'pistol' ? 'PISTOL  •  click to shoot' : 'FISTS  •  click to punch', 24, 88);
  // Reputation and crew: what the street thinks of Rex, and who rides
  // with him. Shown under the cash so a screenshot carries them.
  if (state.standing) {
    const top = topDistrict(state.standing);
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`REP ${state.standing.rep}  •  LV ${standingLevel(state.standing)}  •  Top turf: ${top.name}`, 24, 108);
  }
  const crew = crewNames(state);
  if (crew.length > 0) {
    ctx.fillStyle = '#b06fd8';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`CREW: ${crew.join('  •  ')}`, 24, 126);
  }
  // Wanted stars, top right.
  drawStars(ctx, state.wanted.stars, VIEW.width - 170, 40);
  if (state.wanted.stars > 0) {
    ctx.fillStyle = '#ff5a4d';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('WANTED — lose the cops', VIEW.width - 16, 62);
    ctx.textAlign = 'left';
  }
  // Speed, bottom right.
  if (!player.onFoot && player.car) {
    const kmh = Math.round(player.car.speed * 0.55);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(VIEW.width - 150, VIEW.height - 54, 136, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh}`, VIEW.width - 52, VIEW.height - 24);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('km/h', VIEW.width - 22, VIEW.height - 24);
    ctx.textAlign = 'left';
    if (player.car.health < 100) {
      ctx.fillStyle = '#ff5a4d';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(`CAR ${Math.ceil(player.car.health)}%`, VIEW.width - 150, VIEW.height - 64);
    }
  }
  // Objective banner, top centre. The job counter rides with it so a
  // screenshot shows the story's size: Job 4 of 9.
  if (state.missions.objective) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    const jobText = state.missions.active && state.missions.index < MISSION_COUNT
      ? `  •  Job ${state.missions.index + 1} of ${MISSION_COUNT}` : '';
    const text = state.missions.objective + jobText;
    const width = ctx.measureText(text).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect((VIEW.width - width) / 2, 14, width, 32);
    ctx.fillStyle = '#ffd23d';
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW.width / 2, 36);
    ctx.textAlign = 'left';
  }
  // Race clock, under the objective banner while a race runs.
  if (state.race && state.race.active) {
    const race = state.race;
    const text = `RACE ${formatRaceTime(race.time)}  •  CP ${race.cpIndex + 1}/${race.checkpoints.length}  •  PAR ${formatRaceTime(race.par)}${race.best !== null ? `  •  BEST ${formatRaceTime(race.best)}` : ''}`;
    ctx.font = 'bold 15px system-ui, sans-serif';
    const width = ctx.measureText(text).width + 28;
    ctx.fillStyle = 'rgba(80,20,120,0.75)';
    ctx.fillRect((VIEW.width - width) / 2, 54, width, 30);
    ctx.fillStyle = '#e8c8ff';
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW.width / 2, 75);
    ctx.textAlign = 'left';
  }
  // Dispatch radio: red, under the banner (or under the race clock).
  if (state.dispatch && state.dispatch.line) {
    const y = state.race && state.race.active ? 96 : 58;
    ctx.font = 'bold 15px system-ui, sans-serif';
    const width = ctx.measureText(state.dispatch.line).width + 28;
    ctx.fillStyle = 'rgba(60,0,0,0.75)';
    ctx.fillRect((VIEW.width - width) / 2, y, width, 30);
    ctx.fillStyle = '#ff5a4d';
    ctx.textAlign = 'center';
    ctx.fillText(state.dispatch.line, VIEW.width / 2, y + 21);
    ctx.textAlign = 'left';
  }
  // Off-screen target arrow: point at the mission target from the screen edge.
  if (state.missions.target) {
    const camera = state.camera;
    const t = state.missions.target;
    const sx = t.x - camera.x;
    const sy = t.y - camera.y;
    if (sx < 0 || sx > VIEW.width || sy < 0 || sy > VIEW.height) {
      const cx = VIEW.width / 2;
      const cy = VIEW.height / 2;
      const angle = Math.atan2(sy - cy, sx - cx);
      const ax = cx + Math.cos(angle) * (VIEW.width / 2 - 60);
      const ay = cy + Math.sin(angle) * (VIEW.height / 2 - 60);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(angle);
      ctx.fillStyle = '#ffd23d';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  // "Steal" prompt when a car is in reach.
  if (state.stealPrompt) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    const text = 'Press E to steal the car';
    const width = ctx.measureText(text).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect((VIEW.width - width) / 2, VIEW.height - 130, width, 34);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW.width / 2, VIEW.height - 107);
    ctx.textAlign = 'left';
  }
  // Dialogue box, bottom centre — above the minimap so the map never covers
  // the text.
  if (state.missions.dialogue) {
    const text = state.missions.dialogue.text;
    ctx.font = '15px system-ui, sans-serif';
    const lines = wrapText(ctx, text, VIEW.width - 320);
    const boxH = lines.length * 20 + 20;
    const boxY = MINIMAP_Y - boxH - 12;
    ctx.fillStyle = 'rgba(10,14,18,0.85)';
    ctx.fillRect(140, boxY, VIEW.width - 280, boxH);
    ctx.fillStyle = '#ffd23d';
    ctx.fillRect(140, boxY, 4, boxH);
    ctx.fillStyle = '#fff';
    lines.forEach((line, i) => ctx.fillText(line, 158, boxY + 8 + (i + 1) * 20));
  }
  // Damage vignette.
  if (player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(217,47,47,${player.hurtFlash * 0.5})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
  drawMinimap(ctx, state);
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawTitle(ctx, state, saveAvailable) {
  ctx.save();
  ctx.fillStyle = '#0e1a24';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Sun-soaked gradient sky and a skyline silhouette.
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  gradient.addColorStop(0, '#ff9a5c');
  gradient.addColorStop(0.45, '#f2c14e');
  gradient.addColorStop(1, '#2f8fae');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW.width, 380);
  ctx.fillStyle = '#1c2a38';
  const buildings = [120, 220, 160, 300, 200, 260, 180, 320, 150, 240, 190];
  let bx = 0;
  for (const h of buildings) {
    ctx.fillRect(bx, 380 - h, 116, h);
    bx += 116;
  }
  ctx.fillStyle = '#0e1a24';
  ctx.fillRect(0, 380, VIEW.width, VIEW.height - 380);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('SOLMAR HEAT', VIEW.width / 2, 200);
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('Nine jobs. Street races. District standing. A crew that has your back.', VIEW.width / 2, 244);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#cfe8f2';
  const menu = saveAvailable
    ? ['1 — Continue', '2 — New Game', '3 — How to Play']
    : ['1 — New Game', '2 — How to Play'];
  menu.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 440 + i * 36));
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#9fb8c8';
  ctx.fillText('WASD move • Mouse aim • Click attack • E steal / exit car • Shift run • Space handbrake • Esc pause • M mute', VIEW.width / 2, 580);
  ctx.fillText('Click a menu item or press its number. Your progress saves automatically.', VIEW.width / 2, 606);
  ctx.restore();
}

export function drawHowToPlay(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,22,0.97)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('How to Play', 120, 100);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  const lines = [
    'You are Rex Marlowe, a driver-for-hire in the coastal city of Solmar.',
    '',
    'WASD / arrows — move on foot, drive when in a car',
    'Mouse — aim. Click — punch, or shoot when you carry a pistol.',
    'E — steal the nearest car / get out of your car',
    'Shift — run. Space — handbrake turn while driving.',
    '',
    'Follow the yellow M to start a job for Delia Voss. Nine jobs, one story:',
    'steal cars, move packages, lose the cops, race the streets and finish Rourke for good.',
    '',
    'Finish jobs to raise your standing in each district and grow your crew —',
    'Milo the mechanic, Vera the wheelwoman and Tomas the lookout each pay off',
    'on the street. Beat the clock in street races from the beach start line.',
    '',
    'Crime raises your wanted stars. The police chase you — lose them and lay low',
    'and the heat cools off. Get caught on foot at zero health and you are WASTED;',
    'held still by a cruiser and you are BUSTED. Either way you wake up at the clinic,',
    'a little poorer, and the city is still yours.',
    '',
    'Press Esc to go back.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, 120, 150 + i * 30));
  ctx.restore();
}

export function drawPause(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2 - 20);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Esc to resume • your game is saved', VIEW.width / 2, VIEW.height / 2 + 24);
  ctx.restore();
}

export function drawEndScreen(ctx, title, subtitle, detail) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,10,14,0.82)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = title === 'WASTED' ? '#ff5a4d' : '#ffd23d';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText(title, VIEW.width / 2, VIEW.height / 2 - 30);
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(subtitle, VIEW.width / 2, VIEW.height / 2 + 14);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#cfe8f2';
  ctx.fillText(detail, VIEW.width / 2, VIEW.height / 2 + 48);
  ctx.fillText('Press Enter to get back on the streets', VIEW.width / 2, VIEW.height / 2 + 92);
  ctx.restore();
}
