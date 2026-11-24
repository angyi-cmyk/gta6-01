// The city of Neon Bay: a static layout of roads, blocks, buildings, a park, a
// beach and a port. One job: answer where things are and what blocks movement.
import { WORLD, PALETTE } from './config.js';
import { makeRng, pick, range, rangeInt, clamp } from './random.js';

// Road centre lines, one set running north-south and one east-west.
export const ROAD_LINES = [225, 675, 1125, 1575, 2025, 2475, 2925, 3375];
const ROAD_HALF = WORLD.roadWidth / 2;

export function isRoadPoint(x, y) {
  for (const line of ROAD_LINES) {
    if (Math.abs(x - line) < ROAD_HALF || Math.abs(y - line) < ROAD_HALF) return true;
  }
  return false;
}

// The nearest road centre line on each axis (used by traffic to stay on roads).
export function nearestRoadLine(value) {
  let best = ROAD_LINES[0];
  for (const line of ROAD_LINES) {
    if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  }
  return best;
}

export function onRoadAxis(value) {
  return Math.abs(value - nearestRoadLine(value)) < ROAD_HALF - 6;
}

// A point on a road, at least `margin` from the world edge.
export function randomRoadPoint(rng, margin = 140) {
  const horizontal = rng() < 0.5;
  const line = pick(rng, ROAD_LINES);
  const along = range(rng, margin, WORLD.size - margin);
  return horizontal ? { x: along, y: line } : { x: line, y: along };
}

// A point on a sidewalk beside a road (where pedestrians walk).
export function randomSidewalkPoint(rng) {
  const horizontal = rng() < 0.5;
  const line = pick(rng, ROAD_LINES);
  const offset = (rng() < 0.5 ? -1 : 1) * (ROAD_HALF + WORLD.sidewalk / 2);
  const along = range(rng, 140, WORLD.size - 140);
  return horizontal ? { x: along, y: line + offset } : { x: line + offset, y: along };
}

function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const containers = [];
  // Blocks are the squares between neighbouring road lines. The beach is the
  // strip along the south edge; the port occupies the north-west corner.
  for (let bx = 0; bx < ROAD_LINES.length - 1; bx += 1) {
    for (let by = 0; by < ROAD_LINES.length - 1; by += 1) {
      const x0 = ROAD_LINES[bx] + ROAD_HALF + WORLD.blockMargin;
      const y0 = ROAD_LINES[by] + ROAD_HALF + WORLD.blockMargin;
      const x1 = ROAD_LINES[bx + 1] - ROAD_HALF - WORLD.blockMargin;
      const y1 = ROAD_LINES[by + 1] - ROAD_HALF - WORLD.blockMargin;
      const w = x1 - x0;
      const h = y1 - y0;
      // The park: one whole block of green in the middle of town.
      if (bx === 3 && by === 3) {
        for (let i = 0; i < 26; i += 1) {
          trees.push({ x: range(rng, x0 + 10, x1 - 10), y: range(rng, y0 + 10, y1 - 10), r: range(rng, 9, 16), color: pick(rng, PALETTE.tree) });
        }
        continue;
      }
      // The port: container yard instead of buildings.
      if (bx === 0 && by === 0) {
        for (let i = 0; i < 14; i += 1) {
          containers.push({
            x: range(rng, x0, x1 - 90), y: range(rng, y0, y1 - 40), w: 84, h: 34,
            color: pick(rng, ['#c9563c', '#3d7dd9', '#e8c832', '#38b8a8', '#8a6f8e']),
          });
        }
        continue;
      }
      // The beach block is sand, no buildings.
      if (by === ROAD_LINES.length - 2) continue;
      const downtown = bx >= 2 && bx <= 4 && by >= 2 && by <= 4;
      const count = downtown ? rangeInt(rng, 2, 3) : rangeInt(rng, 1, 3);
      const cols = count === 1 ? 1 : 2;
      const rows = Math.ceil(count / cols);
      for (let i = 0; i < count; i += 1) {
        const cx = i % cols;
        const cy = Math.floor(i / cols);
        const bw = (w / cols) * range(rng, 0.55, 0.85);
        const bh = (h / rows) * range(rng, 0.55, 0.85);
        const b = {
          x: x0 + (cx * w) / cols + (w / cols - bw) / 2,
          y: y0 + (cy * h) / rows + (h / rows - bh) / 2,
          w: bw,
          h: bh,
          roof: pick(rng, PALETTE.buildingRoof),
          wall: pick(rng, PALETTE.buildingWall),
          tall: downtown && rng() < 0.5,
          name: null,
        };
        buildings.push(b);
      }
      // Street trees along the block edges.
      for (let i = 0; i < 3; i += 1) {
        trees.push({ x: range(rng, x0, x1), y: range(rng, y0, y1), r: range(rng, 7, 12), color: pick(rng, PALETTE.tree) });
      }
    }
  }
  // Landmarks with names the HUD and missions can point at.
  // The Casino Strip: three bright casino fronts along the north side of
  // the downtown block south of the park, facing the road. The generated
  // buildings in this block are replaced, so the strip is always the same.
  for (let i = buildings.length - 1; i >= 0; i -= 1) {
    const b = buildings[i];
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    if (cx > 1651 && cx < 1949 && cy > 2101 && cy < 2399) buildings.splice(i, 1);
  }
  buildings.push(
    { x: 1660, y: 2110, w: 90, h: 150, roof: '#9b30ff', wall: '#f2c230', tall: true, name: 'Golden Palms' },
    { x: 1770, y: 2110, w: 90, h: 140, roof: '#ffd23d', wall: '#d97ab0', tall: false, name: null },
    { x: 1880, y: 2110, w: 64, h: 140, roof: '#e8c832', wall: '#b06fd8', tall: false, name: null },
  );
  const tower = buildings.reduce((best, b) => (b.tall && !b.name && (!best || b.w * b.h > best.w * best.h) ? b : best), null);
  if (tower) tower.name = 'Neon Tower';
  const marina = { x: 2900, y: 3180, name: 'Marina' };
  const stadium = { x: 600, y: 2600, name: 'Stadium' };
  return { buildings, trees, containers, tower, marina, stadium };
}

export const CITY = buildCity(20261121);

// The Casino Strip: the landmark row in downtown, its vault plaza and the
// road-front entrance the Big One starts from. All inside downtown, so the
// seven district boundaries do not move.
export const CASINO_STRIP = {
  x: 1800, y: 2185, // strip centre, between the casino fronts
  casino: { x: 1705, y: 2185 }, // Golden Palms Casino, centre of the big one
  vault: { x: 1800, y: 2340 }, // vault cash plaza, just south of the casinos
  entrance: { x: 1800, y: 2055 }, // on the road north of the strip
  label: { x: 1800, y: 2095 }, // CASINO STRIP map label, above the fronts
};

// Neon signs the 3D renderer stands up in the world: the strip's casino
// fronts and the big NEON BAY arch over the beach road. Each sign is a
// glowing panel with its text, colour and the angle it faces. Casino fronts
// face north, toward the road; the beach-road signs face west, toward the
// eastbound traffic and a chase camera behind it.
export const NEON_SIGNS = [
  { x: 1705, y: 2104, w: 96, h: 34, text: 'GOLDEN PALMS', color: '#ffd23d', angle: -Math.PI / 2 },
  { x: 1815, y: 2104, w: 96, h: 30, text: 'NEON BAY', color: '#ff2d78', angle: -Math.PI / 2 },
  { x: 1912, y: 2104, w: 70, h: 30, text: 'JACKPOT', color: '#2de8ff', angle: -Math.PI / 2 },
  { x: 2250, y: 3375, w: 220, h: 46, text: 'NEON BAY', color: '#ff2d78', angle: Math.PI },
  { x: 1125, y: 3375, w: 150, h: 36, text: 'CASINO STRIP', color: '#ffd23d', angle: Math.PI },
];

// Beach and water: the strip below the last road line.
export const BEACH_TOP = ROAD_LINES[ROAD_LINES.length - 1] + ROAD_HALF;
export const WATER_TOP = WORLD.size - 120;

export function isWater(x, y) {
  return y > WATER_TOP;
}

export function isSand(x, y) {
  return y > BEACH_TOP && y <= WATER_TOP;
}

// True when a circle of radius r at (x, y) hits a building, a container or
// the water (the player and cars cannot swim).
export function hitsSolid(x, y, r) {
  if (x < r || y < r || x > WORLD.size - r || y > WORLD.size - r) return true;
  if (isWater(x, y)) return true;
  for (const b of CITY.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  for (const c of CITY.containers) {
    if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return true;
  }
  return false;
}

// Push a circle out of whatever solid it overlaps (axis-separated, so sliding
// along a wall still works). Returns true when a push happened.
export function resolveSolid(x, y, r) {
  let px = x;
  let py = y;
  px = clamp(px, r, WORLD.size - r);
  py = clamp(py, r, WORLD.size - r);
  if (isWater(px, py)) py = WATER_TOP - r;
  for (const b of CITY.buildings) {
    if (px + r > b.x && px - r < b.x + b.w && py + r > b.y && py - r < b.y + b.h) {
      const left = px + r - b.x;
      const right = b.x + b.w - (px - r);
      const top = py + r - b.y;
      const bottom = b.y + b.h - (py - r);
      const min = Math.min(left, right, top, bottom);
      if (min === left) px = b.x - r;
      else if (min === right) px = b.x + b.w + r;
      else if (min === top) py = b.y - r;
      else py = b.y + b.h + r;
    }
  }
  for (const c of CITY.containers) {
    if (px + r > c.x && px - r < c.x + c.w && py + r > c.y && py - r < c.y + c.h) {
      const left = px + r - c.x;
      const right = c.x + c.w - (px - r);
      const top = py + r - c.y;
      const bottom = c.y + c.h - (py - r);
      const min = Math.min(left, right, top, bottom);
      if (min === left) px = c.x - r;
      else if (min === right) px = c.x + c.w + r;
      else if (min === top) py = c.y - r;
      else py = c.y + c.h + r;
    }
  }
  return { x: px, y: py, pushed: px !== x || py !== y };
}
