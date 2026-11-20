// Missions and story. One job: run the three-job arc for Rex Marlowe, a
// driver-for-hire in Solmar, and tell the HUD what to show.
import { MISSIONS, PALETTE } from './config.js';
import { makeRng, distance, range } from './random.js';
import { CITY, randomRoadPoint } from './city.js';
import { makeCar } from './vehicles.js';
import { addWanted } from './police.js';
import { playMissionComplete, playPhone, playPickup } from './audio.js';

// Delia Voss, the fixer, hires Rex. Kane Rourke runs the docks and has been
// leaning on every driver in Solmar. Three jobs, then the ledger, then free.
export const STORY = {
  intro: 'Solmar. Sun, salt and stolen cars. You are Rex Marlowe, a driver with no licence and a fast reputation. Delia Voss has work for you.',
  briefs: [
    'Job 1 — Wheels Up: a yellow Comet GT is parked at the Marina. Take it. Deliver it to the garage on the east side. No police, no fuss.',
    'Job 2 — The Drop: pick up the package at the Port warehouse, then deliver it to the bench in Solmar Park. Rourke\'s men will not let it go quietly.',
    'Job 3 — The Ledger: Rourke keeps his books in Solmar Tower. Get past his guards, take the ledger, and bring it to the safehouse. Finish this.',
  ],
  done: 'The ledger is yours. Rourke\'s empire folds by morning, and every driver in Solmar owes you one. Free roam — the city is yours now.',
};

export function makeMissions() {
  return {
    index: 0, // which mission is current (0..2); 3 means the story is done
    stage: 0, // which stage of the current mission
    active: false,
    objective: '',
    target: null, // {x, y, label} the HUD arrow and minimap point at
    markerCar: null,
    guards: [],
    pickupReady: false,
    packageHeld: false,
    ledgerHeld: false,
    dialogue: null, // {text, until} shown in the dialogue box
    dialogueQueue: [],
  };
}

function say(missions, text, seconds = 5) {
  missions.dialogue = { text, seconds };
}

// Where the mission markers live.
export function missionSpots() {
  return {
    marinaCar: { x: CITY.marina.x, y: CITY.marina.y },
    garage: { x: 3230, y: 675 },
    portPickup: { x: 420, y: 420 },
    parkBench: { x: 1380, y: 2250 },
    tower: CITY.tower ? { x: CITY.tower.x + CITY.tower.w / 2, y: CITY.tower.y + CITY.tower.h / 2 } : { x: 1800, y: 1800 },
    safehouse: { x: 700, y: 3050 },
  };
}

function startMission(state, index) {
  const missions = state.missions;
  const spots = missionSpots();
  missions.index = index;
  missions.stage = 0;
  missions.active = true;
  missions.packageHeld = false;
  missions.ledgerHeld = false;
  missions.pickupReady = false;
  playPhone();
  if (index === 0) {
    // A yellow Comet GT waits at the Marina.
    const car = makeCar(spots.marinaCar.x, spots.marinaCar.y, Math.PI / 2, {
      type: 'mission', driver: 'none', color: '#e8c832', topSpeed: 430,
    });
    state.cars.push(car);
    missions.markerCar = car;
    missions.objective = 'Steal the yellow Comet GT at the Marina';
    missions.target = { x: spots.marinaCar.x, y: spots.marinaCar.y, label: 'Comet GT' };
    say(missions, 'Delia: "Rex. A yellow Comet GT is sitting at the Marina, keys in it. Take it to my garage east side. Don\'t scratch it."');
  } else if (index === 1) {
    missions.objective = 'Pick up the package at the Port warehouse';
    missions.target = { x: spots.portPickup.x, y: spots.portPickup.y, label: 'Package' };
    say(missions, 'Delia: "Rourke\'s boys move a package through the Port tonight. Grab it before they do, then bring it to the bench in Solmar Park."');
  } else if (index === 2) {
    // Four armed guards hold the tower entrance.
    const tower = spots.tower;
    const guards = [];
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2;
      guards.push({
        x: tower.x + Math.cos(angle) * 150,
        y: tower.y + Math.sin(angle) * 150,
        angle,
        health: 60,
        down: false,
        alerted: false,
        shootCooldown: range(state.rng, 0.5, 1.5),
        speed: 120,
      });
    }
    state.guards = guards;
    missions.guards = guards;
    missions.objective = 'Fight past Rourke\'s guards at Solmar Tower';
    missions.target = { x: tower.x, y: tower.y, label: 'Solmar Tower' };
    say(missions, 'Delia: "Last one, Rex. Rourke\'s ledger is in Solmar Tower. Four of his men guard the door. Take the ledger and meet me at the safehouse."');
  }
}

function completeMission(state) {
  const missions = state.missions;
  const reward = MISSIONS.reward[missions.index];
  state.player.money += reward;
  state.player.missionsDone += 1;
  playMissionComplete();
  missions.active = false;
  missions.objective = '';
  missions.target = null;
  missions.markerCar = null;
  if (missions.index === 0) {
    state.player.weapon = 'pistol';
    say(missions, `Delia: "Clean work. $${reward} in your pocket — and take this pistol. Job two will be louder."`, 6);
  } else if (missions.index === 1) {
    say(missions, `Delia: "The package is safe. $${reward}. One more job, Rex, and Rourke is finished."`, 6);
  } else {
    say(missions, STORY.done, 8);
  }
  missions.index += 1;
  if (missions.index < 3) {
    missions.dialogueQueue.push(missions.index);
  }
  if (state.saveGame) state.saveGame();
}

// Called by combat when a guard goes down: when all four are down, the
// ledger appears at the tower door.
export function onGuardDown(state) {
  const missions = state.missions;
  if (missions.index !== 2 || missions.stage !== 0) return;
  const alive = state.guards.filter((g) => !g.down).length;
  if (alive === 0) {
    missions.stage = 1;
    const spots = missionSpots();
    missions.objective = 'Grab the ledger at the tower door';
    missions.target = { x: spots.tower.x, y: spots.tower.y, label: 'Ledger' };
    missions.pickupReady = true;
    say(missions, 'Delia: "All four down. The ledger is by the door — grab it."');
  }
}

// Step the current mission: check arrivals, pickups and stage changes.
export function updateMissions(state, dt) {
  const missions = state.missions;
  const player = state.player;
  if (missions.dialogue) {
    missions.dialogue.seconds -= dt;
    if (missions.dialogue.seconds <= 0) {
      missions.dialogue = null;
      if (missions.dialogueQueue.length > 0) {
        const next = missions.dialogueQueue.shift();
        startMission(state, next);
      }
    }
  }
  if (!missions.active) return;
  const spots = missionSpots();
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  if (missions.index === 0) {
    if (missions.stage === 0) {
      // Stage 0: steal the Comet GT (get in it).
      if (player.car === missions.markerCar) {
        missions.stage = 1;
        missions.objective = 'Deliver the Comet GT to Delia\'s garage';
        missions.target = { x: spots.garage.x, y: spots.garage.y, label: 'Garage' };
        say(missions, 'Delia: "You have it. East side garage — the yellow marker. Easy does it."');
      }
    } else if (distance(px, py, spots.garage.x, spots.garage.y) < 110 && player.car === missions.markerCar) {
      completeMission(state);
    }
  } else if (missions.index === 1) {
    if (missions.stage === 0) {
      // Stage 0: walk to the package at the Port.
      if (player.onFoot && distance(player.x, player.y, spots.portPickup.x, spots.portPickup.y) < 60) {
        missions.stage = 1;
        missions.packageHeld = true;
        missions.objective = 'Deliver the package to the bench in Solmar Park';
        missions.target = { x: spots.parkBench.x, y: spots.parkBench.y, label: 'Park bench' };
        playPickup();
        addWanted(state, 2, 'Rourke\'s men called the police');
        say(missions, 'Delia: "You\'ve got it — and Rourke\'s men just called the cops. Lose them, get to the park."', 6);
      }
    } else if (player.onFoot && distance(player.x, player.y, spots.parkBench.x, spots.parkBench.y) < 60) {
      missions.packageHeld = false;
      completeMission(state);
    }
  } else if (missions.index === 2) {
    if (missions.stage === 1) {
      // Stage 1: pick up the ledger on foot.
      if (missions.pickupReady && player.onFoot && distance(player.x, player.y, spots.tower.x, spots.tower.y) < 90) {
        missions.stage = 2;
        missions.ledgerHeld = true;
        missions.pickupReady = false;
        missions.objective = 'Escape to the safehouse with the ledger';
        missions.target = { x: spots.safehouse.x, y: spots.safehouse.y, label: 'Safehouse' };
        playPickup();
        addWanted(state, 2, 'the tower alarm went off');
        say(missions, 'Delia: "Ledger secured. The alarm is up — get to the safehouse, south-west corner."', 6);
      }
    } else if (missions.stage === 2 && distance(px, py, spots.safehouse.x, spots.safehouse.y) < 110) {
      missions.ledgerHeld = false;
      completeMission(state);
    }
  }
}

// The yellow "M" blip on the minimap and in the world: where the next job
// starts. When no mission is active and the story is not done, the player
// starts the next job by driving or walking into the blip.
export function missionStartPoint(state) {
  const spots = missionSpots();
  const index = state.missions.index;
  if (index === 0) return { x: spots.marinaCar.x, y: spots.marinaCar.y };
  if (index === 1) return { x: spots.portPickup.x, y: spots.portPickup.y };
  if (index === 2) return spots.tower;
  return null;
}

export function tryStartMission(state) {
  const missions = state.missions;
  if (missions.active || missions.index >= 3) return;
  const point = missionStartPoint(state);
  if (!point) return;
  const px = state.player.car ? state.player.car.x : state.player.x;
  const py = state.player.car ? state.player.car.y : state.player.y;
  if (distance(px, py, point.x, point.y) < 130) {
    startMission(state, missions.index);
  }
}
