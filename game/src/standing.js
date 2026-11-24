// District standing: the city's neighbourhoods remember what Rex does.
// One job: turn finished work into reputation, and reputation into levels.
import { BEACH_TOP } from './city.js';

export const DISTRICTS = {
  marina: 'Marina',
  downtown: 'Downtown',
  port: 'Port',
  park: 'Neon Park',
  beach: 'Beach',
  uptown: 'Uptown',
  westside: 'Westside',
};

// Which district a point on the map belongs to.
export function districtAt(x, y) {
  if (y > BEACH_TOP) return 'beach';
  if (x < 1125 && y < 1125) return 'port';
  if (x >= 1651 && x <= 1949 && y >= 1651 && y <= 1949) return 'park';
  if (x > 2475 && y > 2475) return 'marina';
  if (x < 1125) return 'westside';
  if (y < 1125) return 'uptown';
  return 'downtown';
}

export function makeStanding() {
  return {
    rep: 0,
    byDistrict: { marina: 0, downtown: 0, port: 0, park: 0, beach: 0, uptown: 0, westside: 0 },
  };
}

// A new level every 30 reputation.
export function standingLevel(standing) {
  return 1 + Math.floor(standing.rep / 30);
}

// A finished job earns 10 reputation in the district where it ended.
export function addStanding(state, district, points) {
  const standing = state.standing;
  if (!standing) return;
  standing.rep += points;
  if (district in standing.byDistrict) standing.byDistrict[district] += points;
}

// The district Rex owns hardest — shown on the HUD.
export function topDistrict(standing) {
  let best = 'downtown';
  let bestPoints = -1;
  for (const [id, points] of Object.entries(standing.byDistrict)) {
    if (points > bestPoints) {
      best = id;
      bestPoints = points;
    }
  }
  return { id: best, name: DISTRICTS[best], points: bestPoints };
}
