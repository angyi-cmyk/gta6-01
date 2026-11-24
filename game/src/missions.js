// Missions and story. One job: run the nine-job arc for Rex Marlowe, a
// driver-for-hire in Solmar, and tell the HUD what to show.
import { MISSIONS, PALETTE } from './config.js';
import { makeRng, distance, range } from './random.js';
import { CITY, randomRoadPoint } from './city.js';
import { makeCar } from './vehicles.js';
import { addWanted } from './police.js';
import { playMissionComplete, playPhone, playPickup } from './audio.js';
import { districtAt, addStanding } from './standing.js';
import { startStreetRace, RACE_COURSE } from './race.js';
import { joinCrew, hasCrew, CREW } from './crew.js';

// Delia Voss, the fixer, hires Rex. Kane Rourke runs the docks and has been
// leaning on every driver in Solmar. Nine jobs: the first three break Rourke,
// the rest are the fallout — and the crew Rex builds along the way.
export const STORY = {
  intro: 'Solmar. Sun, salt and stolen cars. You are Rex Marlowe, a driver with no licence and a fast reputation. Delia Voss has work for you.',
  briefs: [
    'Job 1 — Wheels Up: a yellow Comet GT is parked at the Marina. Take it. Deliver it to the garage on the east side. No police, no fuss.',
    'Job 2 — The Drop: pick up the package at the Port warehouse, then deliver it to the bench in Solmar Park. Rourke\'s men will not let it go quietly.',
    'Job 3 — The Ledger: Rourke keeps his books in Solmar Tower. Get past his guards, take the ledger, and bring it to the safehouse. Finish this.',
    'Job 4 — Hot Wheels: a purple Falcon X is parked at the Stadium. It is the rarest car in Solmar. Take it to the garage — and meet Milo, the mechanic who keeps it running.',
    'Job 5 — The Long Haul: a crate is waiting in the Port container yard. Carry it across town to the Grand Solmar Hotel. Rourke\'s men still watch the docks.',
    'Job 6 — Lose the Tail: Delia tipped the cops and now they are all over you. Lose them — get your wanted level to zero — then reach the hideout.',
    'Job 7 — Street Kings: the beach crew runs a race through the city. Four checkpoints, beat the clock, and Vera the wheelwoman will owe you one.',
    'Job 8 — The Blockade: Rourke\'s last men hold the Port yard and the evidence that buries them. Fight through, grab it, and run it to the safehouse.',
    'Job 9 — The Crew\'s Cut: three cash drops are stashed around the city — Marina, Park, Stadium. Collect them all and bring the take to the garage.',
  ],
  done: 'Nine jobs. Rourke is finished, the crew is yours, and every driver in Solmar owes you one. Free roam — the city is yours now, and the beach race line is always open.',
};

export const MISSION_COUNT = 9;

export function makeMissions() {
  return {
    index: 0, // which mission is current (0..8); 9 means the story is done
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
    cleanTimer: 0, // Job 6: seconds spent at zero wanted stars
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
    stadiumCar: { x: 600, y: 2600 },
    hotel: { x: 2025, y: 1575 },
    downtown: { x: 2025, y: 2025 },
    raceStart: { x: 1125, y: 3375 },
    portYard: { x: 420, y: 420 },
    cashDrops: [
      { x: CITY.marina.x, y: CITY.marina.y, label: 'Marina drop' },
      { x: 1380, y: 2250, label: 'Park drop' },
      { x: 600, y: 2600, label: 'Stadium drop' },
    ],
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
  missions.cleanTimer = 0;
  playPhone();
  // Milo the mechanic patches the car up before every job, once he is in.
  if (hasCrew(state, 'milo') && state.player.car) {
    state.player.car.health = 100;
  }
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
  } else if (index === 3) {
    // A purple Falcon X waits at the Stadium — the rarest car in Solmar.
    const car = makeCar(spots.stadiumCar.x, spots.stadiumCar.y, Math.PI / 2, {
      type: 'mission', driver: 'none', color: '#8a6f8e', topSpeed: 450,
    });
    state.cars.push(car);
    missions.markerCar = car;
    missions.objective = 'Steal the purple Falcon X at the Stadium';
    missions.target = { x: spots.stadiumCar.x, y: spots.stadiumCar.y, label: 'Falcon X' };
    say(missions, 'Delia: "Rourke\'s gone but his toys are still out there. A purple Falcon X is parked at the Stadium — the rarest car in Solmar. Bring it to the garage."');
  } else if (index === 4) {
    missions.objective = 'Pick up the crate at the Port container yard';
    missions.target = { x: spots.portYard.x, y: spots.portYard.y, label: 'Crate' };
    say(missions, 'Delia: "A crate is sitting in the Port yard and it is worth more than the car you stole. Grab it, cross town, and drop it at the Grand Solmar Hotel."');
  } else if (index === 5) {
    // The cops are already on Rex: lose them, then reach the hideout.
    addWanted(state, 3, 'Delia tipped the cops — now lose them');
    missions.objective = 'Lose the cops — get your wanted level to zero';
    missions.target = null;
    say(missions, 'Delia: "Bad news — I had to tip the cops to buy us time, and now they are all over you. Lose them, lay low until the stars are gone, then meet me at the hideout."', 6);
  } else if (index === 6) {
    // A street race: four checkpoints, beat the clock.
    startStreetRace(state, 'mission');
    missions.objective = 'Street race — hit all 4 checkpoints before the clock runs out';
    missions.target = { x: RACE_COURSE[0].x, y: RACE_COURSE[0].y, label: 'CP1' };
    say(missions, 'Delia: "The beach crew runs a race tonight — four checkpoints across the city, beat the clock. Win it and Vera the wheelwoman owes you one."', 6);
  } else if (index === 7) {
    // Four armed guards hold the Port yard and the evidence.
    const yard = spots.portYard;
    const guards = [];
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2;
      guards.push({
        x: yard.x + Math.cos(angle) * 150,
        y: yard.y + Math.sin(angle) * 150,
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
    missions.objective = 'Fight past Rourke\'s men at the Port yard';
    missions.target = { x: yard.x, y: yard.y, label: 'Port yard' };
    say(missions, 'Delia: "Rourke\'s last men are holed up in the Port yard with the evidence that buries them. Four guards. Take it and run it to the safehouse."', 6);
  } else if (index === 8) {
    // Three cash drops stashed around the city.
    const drop = spots.cashDrops[0];
    missions.objective = 'Collect the crew\'s cut — cash drop 1 of 3';
    missions.target = { x: drop.x, y: drop.y, label: drop.label };
    say(missions, 'Delia: "Last job, Rex. Three cash drops are stashed around the city — Marina, Park, Stadium. Collect them all and bring the take to the garage."', 6);
  }
}

function completeMission(state) {
  const missions = state.missions;
  const reward = MISSIONS.reward[missions.index];
  // Vera the wheelwoman takes a cut of the street — and pays one back.
  const bonus = hasCrew(state, 'vera') ? 250 : 0;
  state.player.money += reward + bonus;
  state.player.missionsDone += 1;
  playMissionComplete();
  // Reputation: the district where the job ended remembers it.
  addStanding(state, districtAt(state.player.x, state.player.y), 10);
  missions.active = false;
  missions.objective = '';
  missions.target = null;
  missions.markerCar = null;
  const bonusText = bonus > 0 ? ` (+$${bonus} Vera bonus)` : '';
  if (missions.index === 0) {
    state.player.weapon = 'pistol';
    say(missions, `Delia: "Clean work. $${reward + bonus} in your pocket${bonusText} — and take this pistol. Job two will be louder."`, 6);
  } else if (missions.index === 1) {
    say(missions, `Delia: "The package is safe. $${reward + bonus}${bonusText}. Rourke is finished — but his fallout is just starting."`, 6);
  } else if (missions.index === 2) {
    say(missions, `Delia: "The ledger is yours. Rourke's empire folds by morning — but his fallout is just starting. More work coming, Rex."`, 7);
  } else if (missions.index === 3) {
    joinCrew(state, 'milo');
    say(missions, `Delia: "The Falcon X is ours. $${reward + bonus}${bonusText}. And Milo the mechanic is in — ${CREW.milo.bonus.toLowerCase()}."`, 7);
  } else if (missions.index === 4) {
    say(missions, `Delia: "Crate delivered, no questions asked. $${reward + bonus}${bonusText}."`, 6);
  } else if (missions.index === 5) {
    joinCrew(state, 'vera');
    say(missions, `Delia: "You shook them clean. $${reward + bonus}${bonusText}. Vera the wheelwoman saw the whole thing — she is in. ${CREW.vera.bonus}."`, 7);
  } else if (missions.index === 6) {
    say(missions, `Delia: "Street Kings! $${reward + bonus}${bonusText}. The beach crew is talking about you now."`, 6);
  } else if (missions.index === 7) {
    joinCrew(state, 'tomas');
    say(missions, `Delia: "Evidence secured. $${reward + bonus}${bonusText}. Tomas the lookout is in — ${CREW.tomas.bonus.toLowerCase()}."`, 7);
  } else {
    say(missions, `${STORY.done} $${state.player.money.toLocaleString('en-US')} banked, and the crew rides with you.`, 8);
  }
  missions.index += 1;
  if (missions.index < MISSION_COUNT) {
    missions.dialogueQueue.push(missions.index);
  }
  if (state.saveGame) state.saveGame();
}

// Called by combat when a guard goes down: when all guards of a guard job
// are down, the pickup appears (ledger at the tower, evidence at the yard).
export function onGuardDown(state) {
  const missions = state.missions;
  if ((missions.index !== 2 && missions.index !== 7) || missions.stage !== 0) return;
  const alive = state.guards.filter((g) => !g.down).length;
  if (alive === 0) {
    missions.stage = 1;
    const spots = missionSpots();
    if (missions.index === 2) {
      missions.objective = 'Grab the ledger at the tower door';
      missions.target = { x: spots.tower.x, y: spots.tower.y, label: 'Ledger' };
      say(missions, 'Delia: "All four down. The ledger is by the door — grab it."');
    } else {
      missions.objective = 'Grab the evidence at the yard';
      missions.target = { x: spots.portYard.x, y: spots.portYard.y, label: 'Evidence' };
      say(missions, 'Delia: "All four down. The evidence is in the yard — grab it."');
    }
    missions.pickupReady = true;
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
  } else if (missions.index === 3) {
    if (missions.stage === 0) {
      // Stage 0: steal the Falcon X (get in it).
      if (player.car === missions.markerCar) {
        missions.stage = 1;
        missions.objective = 'Deliver the Falcon X to Delia\'s garage';
        missions.target = { x: spots.garage.x, y: spots.garage.y, label: 'Garage' };
        say(missions, 'Delia: "You have it. East side garage — same as the Comet. Milo is waiting there with a wrench."');
      }
    } else if (distance(px, py, spots.garage.x, spots.garage.y) < 110 && player.car === missions.markerCar) {
      completeMission(state);
    }
  } else if (missions.index === 4) {
    if (missions.stage === 0) {
      // Stage 0: walk to the crate in the Port yard.
      if (player.onFoot && distance(player.x, player.y, spots.portYard.x, spots.portYard.y) < 60) {
        missions.stage = 1;
        missions.packageHeld = true;
        missions.objective = 'Deliver the crate to the Grand Solmar Hotel';
        missions.target = { x: spots.hotel.x, y: spots.hotel.y, label: 'Hotel' };
        playPickup();
        addWanted(state, 2, 'Rourke\'s men called the police');
        say(missions, 'Delia: "Crate is yours — and the yard just called the cops. Cross town, get to the hotel."', 6);
      }
    } else if (player.onFoot && distance(player.x, player.y, spots.hotel.x, spots.hotel.y) < 60) {
      missions.packageHeld = false;
      completeMission(state);
    }
  } else if (missions.index === 5) {
    if (missions.stage === 0) {
      // Stage 0: stay clean until the wanted level is gone.
      if (state.wanted.stars === 0) {
        missions.cleanTimer += dt;
        if (missions.cleanTimer > 3) {
          missions.stage = 1;
          missions.objective = 'Reach the hideout';
          missions.target = { x: spots.safehouse.x, y: spots.safehouse.y, label: 'Hideout' };
          say(missions, 'Delia: "Clean. The heat is off — now get to the hideout, south-west corner."');
        }
      } else {
        missions.cleanTimer = 0;
      }
    } else if (distance(px, py, spots.safehouse.x, spots.safehouse.y) < 110) {
      completeMission(state);
    }
  } else if (missions.index === 6) {
    // The street race: the race state in state.race decides it.
    const race = state.race;
    if (!race) return;
    if (race.finished) {
      // Point the HUD at the next checkpoint as the race runs.
      completeMission(state);
    } else if (race.failed) {
      startStreetRace(state, 'mission');
      say(missions, 'Delia: "Too slow — the clock beat you. Go again, same course."', 5);
    } else if (race.active) {
      const cp = race.checkpoints[race.cpIndex];
      if (cp) {
        missions.objective = `Street race — checkpoint ${race.cpIndex + 1} of ${race.checkpoints.length}`;
        missions.target = { x: cp.x, y: cp.y, label: cp.label };
      }
    }
  } else if (missions.index === 7) {
    if (missions.stage === 1) {
      // Stage 1: pick up the evidence on foot.
      if (missions.pickupReady && player.onFoot && distance(player.x, player.y, spots.portYard.x, spots.portYard.y) < 90) {
        missions.stage = 2;
        missions.ledgerHeld = true;
        missions.pickupReady = false;
        missions.objective = 'Escape to the safehouse with the evidence';
        missions.target = { x: spots.safehouse.x, y: spots.safehouse.y, label: 'Safehouse' };
        playPickup();
        addWanted(state, 2, 'the yard alarm went off');
        say(missions, 'Delia: "Evidence secured. The alarm is up — get to the safehouse, south-west corner."', 6);
      }
    } else if (missions.stage === 2 && distance(px, py, spots.safehouse.x, spots.safehouse.y) < 110) {
      missions.ledgerHeld = false;
      completeMission(state);
    }
  } else if (missions.index === 8) {
    // Three cash drops, then the take goes to the garage.
    if (missions.stage < 3) {
      const drop = spots.cashDrops[missions.stage];
      if (player.onFoot && distance(player.x, player.y, drop.x, drop.y) < 60) {
        missions.stage += 1;
        playPickup();
        if (missions.stage < 3) {
          const next = spots.cashDrops[missions.stage];
          missions.objective = `Collect the crew's cut — cash drop ${missions.stage + 1} of 3`;
          missions.target = { x: next.x, y: next.y, label: next.label };
          say(missions, `Delia: "Drop ${missions.stage} of 3 banked. ${3 - missions.stage} to go."`);
        } else {
          missions.objective = 'Deliver the take to Delia\'s garage';
          missions.target = { x: spots.garage.x, y: spots.garage.y, label: 'Garage' };
          say(missions, 'Delia: "All three drops. Bring the take to the garage — the crew eats tonight."', 6);
        }
      }
    } else if (distance(px, py, spots.garage.x, spots.garage.y) < 110) {
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
  if (index === 3) return { x: spots.stadiumCar.x, y: spots.stadiumCar.y };
  if (index === 4) return { x: spots.portYard.x, y: spots.portYard.y };
  if (index === 5) return spots.downtown;
  if (index === 6) return spots.raceStart;
  if (index === 7) return { x: spots.portYard.x, y: spots.portYard.y };
  if (index === 8) return { x: spots.marinaCar.x, y: spots.marinaCar.y };
  return null;
}

export function tryStartMission(state) {
  const missions = state.missions;
  if (missions.active || missions.index >= MISSION_COUNT) return;
  const point = missionStartPoint(state);
  if (!point) return;
  const px = state.player.car ? state.player.car.x : state.player.x;
  const py = state.player.car ? state.player.car.y : state.player.y;
  if (distance(px, py, point.x, point.y) < 130) {
    startMission(state, missions.index);
  }
}
