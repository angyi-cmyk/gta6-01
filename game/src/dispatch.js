// Police dispatch: at three stars and up, dispatch throws a roadblock
// across the road ahead of the player — two parked cruisers — and calls it
// out on the radio. One job: make high heat feel like a trap closing.
import { POLICE, PALETTE } from './config.js';
import { nearestRoadLine } from './city.js';
import { DISTRICTS, districtAt } from './standing.js';
import { makeCar } from './vehicles.js';

export function makeDispatch() {
  return { roadblocks: [], line: '', active: false };
}

// The nearest intersection ahead of the player, snapped to road lines.
function roadblockPoint(state, ahead) {
  const player = state.player;
  const ax = player.x + Math.cos(player.angle) * ahead;
  const ay = player.y + Math.sin(player.angle) * ahead;
  return { x: nearestRoadLine(ax), y: nearestRoadLine(ay) };
}

// Park two cruisers across the road at the intersection ahead and put the
// call on the radio. Returns the two cars. At five stars dispatch closes
// the trap harder: three cruisers, nose to tail across the whole road.
export function spawnRoadblock(state, ahead = 480) {
  const dispatch = state.dispatch;
  const point = roadblockPoint(state, ahead);
  const district = DISTRICTS[districtAt(point.x, point.y)];
  // Across the road the player is travelling on: a driver heading east
  // meets two cars parked nose-to-south, one on each side of the line.
  const horizontal = Math.abs(Math.cos(state.player.angle)) >= Math.abs(Math.sin(state.player.angle));
  const offsets = (state.wanted && state.wanted.stars >= 5) ? [-42, 0, 42] : [-30, 30];
  const cars = [];
  for (const offset of offsets) {
    const car = makeCar(
      horizontal ? point.x : point.x + offset,
      horizontal ? point.y + offset : point.y,
      horizontal ? Math.PI / 2 : 0,
      { type: 'police', driver: 'police', color: PALETTE.policeCar, topSpeed: POLICE.chaseSpeed },
    );
    car.roadblock = true;
    car.vx = 0;
    car.vy = 0;
    car.speed = 0;
    state.cars.push(car);
    cars.push(car);
  }
  dispatch.roadblocks.push(...cars);
  dispatch.line = `DISPATCH: roadblock on ${district} — units converge`;
  dispatch.active = true;
  return cars;
}

// Pull the roadblock cars out of the world and take the call off the radio.
export function clearRoadblock(state) {
  const dispatch = state.dispatch;
  if (!dispatch) return;
  if (dispatch.roadblocks.length > 0) {
    state.cars = state.cars.filter((c) => !c.roadblock);
  }
  dispatch.roadblocks = [];
  dispatch.line = '';
  dispatch.active = false;
}

export function updateDispatch(state, dt) {
  const dispatch = state.dispatch;
  if (!dispatch) return;
  const level = state.wanted ? (state.wanted.stars ?? state.wanted.level ?? 0) : 0;
  if (level >= 3) {
    if (dispatch.roadblocks.length === 0) spawnRoadblock(state);
  } else if (dispatch.roadblocks.length > 0 || dispatch.line) {
    clearRoadblock(state);
  }
}
