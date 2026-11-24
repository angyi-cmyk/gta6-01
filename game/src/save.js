// Save and load through localStorage. One job: remember the player's money,
// story progress and position between sessions.
const SAVE_KEY = 'solmar-heat-save-v1';

export function saveGame(state) {
  try {
    const player = state.player;
    const data = {
      version: 1,
      money: player.money,
      missionsDone: player.missionsDone,
      missionIndex: state.missions.index,
      weapon: player.weapon,
      health: player.health,
      x: player.x,
      y: player.y,
      carsStolen: player.carsStolen,
      kills: state.stats.kills,
      standing: state.standing ? { rep: state.standing.rep, byDistrict: state.standing.byDistrict } : null,
      crew: state.crew ? state.crew.joined : [],
      bestRaceTime: state.race ? state.race.best : null,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (error) {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    // A save that cannot be cleared is not worth breaking the game over.
  }
}
