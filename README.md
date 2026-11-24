[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/angyi-cmyk/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/angyi-cmyk/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Bay Nights

A 3D open-world crime game in the browser — a complete original neon city
to explore on foot and by car, built for [make.fun's GTA 6 bounty](https://make.fun/bounty/gta6-01).
The city renders in real 3D (Three.js, vendored offline under
`game/vendor/`, no network at runtime): a chase camera follows your car
through wet neon streets, and a high over-shoulder camera follows you on
foot, past lit towers, the Casino Strip and the NEON BAY arch.

You are Rex Marlowe, a driver-for-hire in Neon Bay, a neon casino city
that never sleeps. Steal cars, outrun the police, and run ten jobs for
the fixer Delia Voss: lift a Comet GT from the Marina, move a package
through the Port, take the ledger from Neon Tower — then steal the
Falcon X, haul a crate across town, lose a three-star tail, win a street
race, break a police blockade, collect the crew's cut — and finish with
the Big One: the Golden Palms Casino vault on the Casino Strip.

## Play

Serve `game/` with any static server and open `game/index.html` in desktop
Chrome — no network, no build step, no files outside `game/`:

```
node serve.ts   # serves game/ on http://localhost:8080
```

- **WASD / arrows** — move on foot, drive when in a car
- **Mouse** — aim. **Click** — punch, or shoot when you carry a pistol.
- **E** — steal the nearest car / get out of your car
- **Shift** — run. **Space** — handbrake turn while driving.
- **Esc** — pause (autosaves). **M** — mute.

## What is in the game

- A 3.6 km² neon city at night: grid streets with wet, reflecting
  asphalt, downtown towers with lit windows, a neon Casino Strip with
  the Golden Palms Casino, a park, a port container yard, a beach and
  the sea — all in 3D, with a chase camera while driving and an
  over-shoulder camera on foot.
- Traffic that drives the roads and pedestrians who walk the sidewalks and
  flee from danger.
- Car stealing, arcade driving with drift, and a wanted level (0–5 stars)
  with police cruisers that chase, ram and bust you. At three stars and up,
  police dispatch throws a roadblock across the road ahead of you — two
  parked cruisers, called out on the radio and marked on the minimap — until
  you shake the heat.
- Ten story missions with objectives, a waypoint arrow, a minimap and
  dialogue — steal cars, move packages, lose the cops, race the streets,
  fight guards and collect cash drops — plus a final casino-vault heist,
  the Big One, at five stars — plus a free-roam city after the
  story ends, with repeatable street races from the beach start line.
- District standing: every finished job earns reputation in the district
  where it ended, with levels and a top turf shown on the HUD.
- A crew that joins as the story runs: Milo the mechanic repairs your car
  before every job, Vera the wheelwoman pays +$250 a job, and Tomas the
  lookout buys you 1.5 seconds more before a bust.
- Street racing: four checkpoints across the city against the clock, as a
  story job and as a repeatable free-roam race, with a best time that saves.
- Combat on foot (fists, then a pistol), armed guards, bullets, wrecks,
  smoke, sparks and skid marks.
- HUD with health, cash, reputation, crew, wanted stars, speed, a race
  clock and a live minimap; a start screen, a how-to-play screen, pause,
  WASTED / BUSTED screens and a localStorage save.
- All sound is synthesized with WebAudio — no audio files.

## Structure

`game/src/` is split by job, one file per system:

| File | Job |
| --- | --- |
| `config.js` | Tuning numbers and the palette |
| `random.js` | Seeded randomness |
| `city.js` | The static city: roads, buildings, park, beach, port |
| `audio.js` | Synthesized sound effects and siren |
| `input.js` | Keyboard and mouse state |
| `player.js` | On-foot movement, driving physics, stealing |
| `vehicles.js` | Traffic AI, car collisions, wrecks |
| `pedestrians.js` | Sidewalk walkers who flee danger |
| `police.js` | Wanted level, cruiser pursuit, BUSTED |
| `dispatch.js` | Police dispatch: roadblocks at three stars and up |
| `combat.js` | Bullets, punches, damage |
| `particles.js` | Smoke, sparks, blood, skid marks |
| `missions.js` | The ten-job story and objectives |
| `standing.js` | District standing: reputation and levels |
| `race.js` | Street racing: checkpoints, clock, best time |
| `crew.js` | The crew roster and what each member is worth |
| `render.js` | 3D rendering: Three.js chase camera, city, cars, people, effects |
| `hud.js` | HUD, minimap and menus |
| `save.js` | localStorage save / load |
| `shots.js` | Deterministic screenshot scenes (`?shot=`) |
| `main.js` | Game loop and screen machine |

Three.js r160 is vendored offline at `game/vendor/three.module.min.js` and
loaded through an import map in `game/index.html` — the game makes no
network request at runtime.

`main.ts` at the repo root copies `game/` and `screenshots/` to `/output` and
writes `/output/dossier.json` with the vendored make.fun library.

## License

MIT — see `LICENSE`. Everything in this game (city, characters, vehicles,
names, story, art, sounds) is original.
