// Street racing: timed checkpoint runs through the city, on the clock.
// One job: start a race, watch the checkpoints, and remember the best time.
import { distance } from './random.js';

// Four corners of the city, in driving order, on road lines.
export const RACE_COURSE = [
  { x: 675, y: 1125, label: 'CP1' },
  { x: 2925, y: 1125, label: 'CP2' },
  { x: 2925, y: 2925, label: 'CP3' },
  { x: 675, y: 2925, label: 'CP4' },
];
export const RACE_PAR_SECONDS = 100;
export const RACE_START = { x: 1125, y: 3375, label: 'Race start' };

export function makeRace() {
  return {
    active: false,
    kind: null, // 'mission' or 'freeroam'
    checkpoints: [],
    cpIndex: 0,
    time: 0,
    par: RACE_PAR_SECONDS,
    best: null, // best finished time in seconds, kept across sessions
    finished: false,
    failed: false,
  };
}

export function startStreetRace(state, kind) {
  const race = state.race;
  race.active = true;
  race.kind = kind;
  race.checkpoints = RACE_COURSE;
  race.cpIndex = 0;
  race.time = 0;
  race.par = RACE_PAR_SECONDS;
  race.finished = false;
  race.failed = false;
}

// Step an active race: count the clock, bank checkpoints as the player
// drives through them, and end it on the last checkpoint or the par time.
export function updateStreetRace(state, dt) {
  const race = state.race;
  if (!race || !race.active) return;
  race.time += dt;
  const player = state.player;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  const cp = race.checkpoints[race.cpIndex];
  if (cp && distance(px, py, cp.x, cp.y) < 120) {
    race.cpIndex += 1;
  }
  if (race.cpIndex >= race.checkpoints.length) {
    race.active = false;
    race.finished = true;
    if (race.best === null || race.time < race.best) {
      race.best = race.time;
      if (state.saveGame) state.saveGame();
    }
    clearRaceObjective(state);
  } else if (race.time > race.par) {
    race.active = false;
    race.failed = true;
    clearRaceObjective(state);
  }
}

// A free-roam race shows its own objective while it runs; take it down
// when the race ends so the HUD goes back to the story.
function clearRaceObjective(state) {
  if (!state.race || state.race.kind !== 'freeroam') return;
  if (state.missions) {
    state.missions.objective = '';
    state.missions.target = null;
  }
}

// The beach start line, open once the story is done: drive into it and a
// race starts. A mission job always wins over a free-roam race.
export function tryStartFreeRoamRace(state) {
  const race = state.race;
  if (!race || race.active) return;
  if (!state.missions || state.missions.active || state.missions.index < 10) return;
  const player = state.player;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  if (distance(px, py, RACE_START.x, RACE_START.y) < 130) {
    startStreetRace(state, 'freeroam');
    state.missions.objective = 'Street race — hit all 4 checkpoints before the clock runs out';
    state.missions.target = { x: RACE_COURSE[0].x, y: RACE_COURSE[0].y, label: 'CP1' };
  }
}

export function formatRaceTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
