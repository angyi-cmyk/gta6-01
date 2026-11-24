// Neon Bay Nights: the game loop, the screens and the wiring between systems.
// One job: own the state and step it every frame.
// The import order is the dossier's outline order (vendor/makefun-game.ts
// importOrder: index.html, then main.js, then its static imports depth
// first): the systems that carry the game lead — ten story missions,
// dispatch, standing, street races, the crew — before the support systems.
import { makeMissions, updateMissions, tryStartMission, missionStartPoint, onGuardDown } from './missions.js';
import { makeDispatch, updateDispatch } from './dispatch.js';
import { makeStanding } from './standing.js';
import { makeRace, updateStreetRace, tryStartFreeRoamRace } from './race.js';
import { makeCrew } from './crew.js';
import { VIEW, WORLD, PLAYER, CAR, MISSIONS, WANTED } from './config.js';
import { makeRng, distance, clamp, angleDelta } from './random.js';
import { CITY, randomRoadPoint, resolveSolid } from './city.js';
import { input, attachInput, endFrame, wasPressed, moveVector } from './input.js';
import { makePlayer, updateOnFoot, updateDriving, nearestStealableCar, enterCar, exitCar, attack } from './player.js';
import { makeCar, spawnTraffic, updateTrafficCar, collideCars, topUpTraffic, isDrivable } from './vehicles.js';
import { spawnPedestrians, updatePedestrian, scarePedestrians } from './pedestrians.js';
import { makeParticles, addParticles, addSkid, addMuzzleFlash, updateParticles } from './particles.js';
import { makeWanted, addWanted, balancePolice, decayWanted, checkBusted, updatePoliceCar } from './police.js';
import { updateBullets, resolvePunch, enemyShoot, hurtPlayer, carHitsPedestrian } from './combat.js';
import { makeCamera, updateCamera, drawWorld, initRenderer, screenToGround, projectToScreen } from './render.js';
import { drawHud, drawTitle, drawHowToPlay, drawPause, drawEndScreen } from './hud.js';
import { saveGame, loadSave, hasSave } from './save.js';
import { initAudio, setMuted, isMuted, updateEngine, updateSiren, playCrash, playPickup, playGunshot } from './audio.js';
import { stageShot } from './shots.js';

// Two stacked canvases: WebGL (the 3D city) below, a 2D canvas (the HUD and
// menus) above it. Input listens on the WebGL canvas; the HUD canvas lets
// pointer events fall through to it.
const glCanvas = document.getElementById('gl');
const hudCanvas = document.getElementById('hud');
const ctx = hudCanvas.getContext('2d');
const rendererOK = initRenderer(glCanvas);
if (!rendererOK) {
  // The game still runs — the HUD draws, the logic steps — but the city
  // cannot render without WebGL. The error is on the window for diagnosis.
  console.error('Neon Bay Nights: WebGL unavailable', window.__webglError);
}

export function createState(seed = 20261121) {
  const rng = makeRng(seed);
  const player = makePlayer(1575, 1575);
  const state = {
    time: 0,
    rng,
    screen: 'title', // title | howto | play | pause | wasted | busted
    player,
    cars: [],
    peds: [],
    guards: [],
    bullets: [],
    particles: makeParticles(),
    missions: makeMissions(),
    standing: makeStanding(),
    race: makeRace(),
    crew: makeCrew(),
    wanted: makeWanted(),
    dispatch: makeDispatch(),
    camera: makeCamera(),
    stats: { kills: 0, earned: 0 },
    stealPrompt: null,
    missionStart: null,
    saveTimer: 0,
    penaltyApplied: false,
    showHowTo: false,
  };
  state.addParticles = (kind, x, y, count) => addParticles(state, kind, x, y, count);
  state.saveGame = () => saveGame(state);
  state.missions.onGuardDown = (s) => onGuardDown(s);
  // The HUD projects mission targets through the 3D camera for its
  // off-screen arrow; the function lives on the state so hud.js needs no
  // import of the renderer.
  state.projectToScreen = projectToScreen;
  spawnTraffic(state, 26);
  spawnPedestrians(state, 42);
  // A few parked cars the player can steal right away.
  for (let i = 0; i < 5; i += 1) {
    const p = randomRoadPoint(rng);
    state.cars.push(makeCar(p.x, p.y, (rng() < 0.5 ? 0 : Math.PI / 2), { driver: 'none' }));
  }
  state.missionStart = missionStartPoint(state);
  return state;
}

let state = createState();

// Debug/test handle: the live game state, for automation and screenshots.
// Read-only by convention; the game never reads it back.
Object.defineProperty(window, '__gameState', { get: () => state });

function applySave(save) {
  state.player.money = save.money;
  state.player.missionsDone = save.missionsDone;
  state.player.weapon = save.weapon;
  state.player.health = save.health;
  state.player.x = save.x;
  state.player.y = save.y;
  state.player.carsStolen = save.carsStolen || 0;
  state.stats.kills = save.kills || 0;
  state.missions.index = save.missionIndex;
  state.missions.active = false;
  if (save.standing) {
    state.standing.rep = save.standing.rep || 0;
    Object.assign(state.standing.byDistrict, save.standing.byDistrict || {});
  }
  if (Array.isArray(save.crew)) state.crew.joined = save.crew;
  if (save.bestRaceTime !== null && save.bestRaceTime !== undefined) state.race.best = save.bestRaceTime;
  state.missionStart = missionStartPoint(state);
}

function resetPlayer(penalty) {
  const player = state.player;
  player.money = Math.max(0, Math.floor(player.money * (1 - penalty)));
  player.health = PLAYER.maxHealth;
  player.x = 1575;
  player.y = 1575;
  player.onFoot = true;
  player.car = null;
  state.wanted.stars = 0;
  state.wanted.quietTimer = 0;
  state.wanted.bustTimer = 0;
  state.cars = state.cars.filter((c) => c.type !== 'police');
  state.bullets = [];
  state.saveGame();
  // A bust or a trip to the clinic ends any race in progress.
  if (state.race && state.race.active) {
    state.race.active = false;
    state.race.failed = true;
    if (state.race.kind === 'freeroam') {
      state.missions.objective = '';
      state.missions.target = null;
    }
  }
}

function respawn(penalty) {
  resetPlayer(penalty);
  state.penaltyApplied = false;
  state.screen = 'play';
}

// Guards: chase the player when alerted, shoot when close enough.
function updateGuards(dt) {
  const player = state.player;
  for (const guard of state.guards) {
    if (guard.down) continue;
    const d = distance(guard.x, guard.y, player.x, player.y);
    if (d < 300) guard.alerted = true;
    if (!guard.alerted) continue;
    const angle = Math.atan2(player.y - guard.y, player.x - guard.x);
    guard.angle = angle;
    if (d > 130) {
      guard.x += Math.cos(angle) * guard.speed * dt;
      guard.y += Math.sin(angle) * guard.speed * dt;
      const solved = resolveSolid(guard.x, guard.y, 12);
      guard.x = solved.x;
      guard.y = solved.y;
    }
    guard.shootCooldown -= dt;
    if (d < 430 && guard.shootCooldown <= 0) {
      guard.shootCooldown = 1.15;
      const bullet = enemyShoot(guard, state);
      if (bullet) {
        state.bullets.push(bullet);
        playGunshot();
      }
    }
  }
}

function updatePlay(dt) {
  const player = state.player;
  state.time += dt;
  const move = moveVector();
  // Aim on foot: unproject the mouse through the 3D camera onto the street.
  const ground = screenToGround();
  if (ground) player.aimAngle = Math.atan2(ground.y - player.y, ground.x - player.x);

  // Enter / exit a car.
  if (wasPressed('KeyE')) {
    if (player.onFoot) {
      const car = nearestStealableCar(player, state.cars);
      if (car) {
        enterCar(player, car);
        player.carsStolen += 1;
        if (car.type === 'police') addWanted(state, WANTED.stealPoliceCar, 'a police cruiser was stolen');
        else if (car.type === 'traffic' || car.type === 'mission') addWanted(state, WANTED.stealCar, 'a car was stolen');
        playPickup();
      }
    } else {
      exitCar(player);
    }
  }

  // Attack with mouse click.
  if (input.clicked && player.onFoot) {
    const result = attack(player, state);
    if (result && result !== 'punch') {
      state.bullets.push(result);
      addMuzzleFlash(state, player.x + Math.cos(player.aimAngle) * 20, player.y + Math.sin(player.aimAngle) * 20, player.aimAngle);
    } else if (result === 'punch') resolvePunch(state, player);
  }

  // Move the player or drive the car.
  if (player.onFoot) {
    updateOnFoot(player, move, dt, input.run);
  } else if (player.car) {
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const throttle = (input.up ? 1 : 0) - (input.down ? 1 : 0);
    const scraped = updateDriving(player.car, steer, throttle, input.handbrake, dt);
    if (scraped) {
      playCrash(player.car.speed / 300);
      addParticles(state, 'spark', player.car.x, player.car.y, 4);
    }
    player.x = player.car.x;
    player.y = player.car.y;
    player.angle = player.car.angle;
    // Skid marks at speed with the handbrake on.
    if (input.handbrake && player.car.speed > 150) {
      addSkid(state, player.car.x, player.car.y, player.car.angle);
    }
    // A wrecked car kicks the player out.
    if (player.car.wrecked) {
      addParticles(state, 'explosion', player.car.x, player.car.y, 20);
      exitCar(player);
      hurtPlayer(state, 12);
    }
  }

  // Traffic and police.
  for (const car of state.cars) {
    if (car.driver === 'traffic') updateTrafficCar(car, state, dt);
    else if (car.driver === 'police') updatePoliceCar(car, state, dt);
  }
  // Car-car collisions.
  for (let i = 0; i < state.cars.length; i += 1) {
    for (let j = i + 1; j < state.cars.length; j += 1) {
      const impact = collideCars(state.cars[i], state.cars[j], state);
      if (impact > 120) {
        const mx = (state.cars[i].x + state.cars[j].x) / 2;
        const my = (state.cars[i].y + state.cars[j].y) / 2;
        addParticles(state, 'spark', mx, my, 6);
        playCrash(impact / 400);
        scarePedestrians(state, mx, my);
      }
    }
  }
  // Cars running over pedestrians (and the player on foot).
  for (const car of state.cars) {
    if (car.speed < 60) continue;
    for (const ped of state.peds) {
      if (!ped.down && distance(car.x, car.y, ped.x, ped.y) < 26) carHitsPedestrian(state, car, ped);
    }
    if (player.onFoot && distance(car.x, car.y, player.x, player.y) < 28 && player.hurtFlash <= 0) {
      hurtPlayer(state, 10);
      const away = Math.atan2(player.y - car.y, player.x - car.x);
      player.x += Math.cos(away) * 30;
      player.y += Math.sin(away) * 30;
    }
  }
  // Wreck smoke.
  for (const car of state.cars) {
    if (car.wrecked) {
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        car.smokeTimer = 0.25;
        addParticles(state, 'smoke', car.x, car.y, 1);
      }
    }
  }

  // Pedestrians.
  const danger = state.bullets.length > 0 ? { x: state.bullets[0].x, y: state.bullets[0].y } : null;
  for (const ped of state.peds) updatePedestrian(ped, state, dt, danger);

  updateGuards(dt);
  updateBullets(state, dt);
  updateParticles(state, dt);
  updateStreetRace(state, dt);
  updateMissions(state, dt);
  tryStartMission(state);
  tryStartFreeRoamRace(state);
  state.missionStart = state.missions.active ? null : missionStartPoint(state);

  // Wanted level: police numbers, the dispatch roadblock, and cooldown.
  updateDispatch(state, dt);
  balancePolice(state);
  if (decayWanted(state, dt)) state.saveGame();
  if (checkBusted(state, dt)) {
    resetPlayer(0.3);
    state.penaltyApplied = true;
    state.screen = 'busted';
  }
  // WASTED: the penalty is applied once, the moment the player goes down.
  if (state.screen === 'wasted' && !state.penaltyApplied) {
    state.penaltyApplied = true;
    resetPlayer(0.2);
  }

  // The steal prompt.
  state.stealPrompt = player.onFoot ? nearestStealableCar(player, state.cars) : null;

  // Traffic top-up and camera.
  topUpTraffic(state);
  updateCamera(state.camera, state, dt);

  // Sound follows the action.
  const driving = !player.onFoot && player.car;
  updateEngine(driving ? player.car.speed / player.car.topSpeed : 0, driving);
  const policeNear = state.cars.some((c) => c.type === 'police' && !c.wrecked && distance(c.x, c.y, player.x, player.y) < 600);
  updateSiren(policeNear && state.wanted.stars > 0, dt);

  // Autosave every 20 seconds.
  state.saveTimer += dt;
  if (state.saveTimer > 20) {
    state.saveTimer = 0;
    state.saveGame();
  }
}

function draw() {
  // The 3D city renders to the WebGL canvas; the HUD and menus draw on the
  // 2D canvas above it. Title and how-to paint their own opaque screens.
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  if (state.screen === 'title') {
    drawTitle(ctx, state, hasSave());
  } else if (state.screen === 'howto') {
    drawHowToPlay(ctx);
  } else if (state.screen === 'pause') {
    drawWorld(state, state.camera);
    drawHud(ctx, state);
    drawPause(ctx);
  } else if (state.screen === 'wasted') {
    drawWorld(state, state.camera);
    drawHud(ctx, state);
    drawEndScreen(ctx, 'WASTED', 'The clinic patched you up. Neon Bay still owes you nothing.', `You lost 20% of your cash. $${state.player.money.toLocaleString('en-US')} left.`);
  } else if (state.screen === 'busted') {
    drawWorld(state, state.camera);
    drawHud(ctx, state);
    drawEndScreen(ctx, 'BUSTED', 'The cops booked you and took their cut.', `You lost 30% of your cash. $${state.player.money.toLocaleString('en-US')} left.`);
  } else {
    drawWorld(state, state.camera);
    drawHud(ctx, state);
  }
}

function startGame(fromSave) {
  initAudio();
  if (fromSave) {
    const save = loadSave();
    if (save) applySave(save);
  } else {
    state = createState();
  }
  state.screen = 'play';
  state.saveGame();
}

function handleTitleInput() {
  // Number keys or a click on a menu line.
  const saveAvailable = hasSave();
  if (wasPressed('Digit1')) startGame(saveAvailable);
  else if (wasPressed('Digit2')) {
    if (saveAvailable) startGame(false);
    else state.screen = 'howto';
  } else if (wasPressed('Digit3')) state.screen = 'howto';
  if (input.clicked) {
    const y = input.mouseY;
    if (y >= 424 && y < 452) startGame(saveAvailable);
    else if (y >= 460 && y < 488) {
      if (saveAvailable) startGame(false);
      else state.screen = 'howto';
    } else if (y >= 496 && y < 524) state.screen = 'howto';
  }
}

let lastTime = 0;
function frame(timestamp) {
  const dt = Math.min(0.05, (timestamp - lastTime) / 1000 || 0.016);
  lastTime = timestamp;
  if (state.screen === 'title') {
    handleTitleInput();
  } else if (state.screen === 'howto') {
    if (wasPressed('Escape')) state.screen = 'title';
  } else if (state.screen === 'play') {
    if (wasPressed('Escape') || wasPressed('KeyP')) {
      state.screen = 'pause';
      state.saveGame();
    } else if (wasPressed('KeyM')) {
      setMuted(!isMuted());
    } else {
      updatePlay(dt);
    }
  } else if (state.screen === 'pause') {
    if (wasPressed('Escape') || wasPressed('KeyP')) state.screen = 'play';
  } else if (state.screen === 'wasted' || state.screen === 'busted') {
    // The penalty was already applied when the player went down or was
    // arrested; Enter just gets back on the streets.
    if (wasPressed('Enter')) {
      state.penaltyApplied = false;
      state.screen = 'play';
    }
  }
  draw();
  endFrame();
  requestAnimationFrame(frame);
}

// Screenshot scenes: ?shot=cover|foot|chase|mission stages a deterministic
// frame from the real game and draws it once, for Playwright to capture.
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  attachInput(glCanvas);
  state = stageShot(shotName, state);
  state.screen = 'play';
  window.__shotState = state;
  draw();
  window.__shotReady = true;
} else {
  attachInput(glCanvas);
  requestAnimationFrame(frame);
}
