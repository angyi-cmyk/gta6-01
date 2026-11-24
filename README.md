[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/angyi-cmyk/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/angyi-cmyk/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Heat

An open-world crime game in the browser — a complete original city to explore
on foot and by car, built for [make.fun's GTA 6 bounty](https://make.fun/bounty/gta6-01).

You are Rex Marlowe, a driver-for-hire in Solmar, a sun-soaked coastal city.
Steal cars, outrun the police, and run nine jobs for the fixer Delia Voss:
lift a Comet GT from the Marina, move a package through the Port, take the
ledger from Solmar Tower — then steal the Falcon X, haul a crate across town,
lose a three-star tail, win a street race, break a police blockade and collect
the crew's cut.

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

- A 3.6 km² city: grid streets, downtown towers, a park, a port container
  yard, a beach and the sea.
- Traffic that drives the roads and pedestrians who walk the sidewalks and
  flee from danger.
- Car stealing, arcade driving with drift, and a wanted level (0–5 stars)
  with police cruisers that chase, ram and bust you.
- Nine story missions with objectives, a waypoint arrow, a minimap and
  dialogue — steal cars, move packages, lose the cops, race the streets,
  fight guards and collect cash drops — plus a free-roam city after the
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
| `combat.js` | Bullets, punches, damage |
| `particles.js` | Smoke, sparks, blood, skid marks |
| `missions.js` | The nine-job story and objectives |
| `standing.js` | District standing: reputation and levels |
| `race.js` | Street racing: checkpoints, clock, best time |
| `crew.js` | The crew roster and what each member is worth |
| `render.js` | Drawing the world |
| `hud.js` | HUD, minimap and menus |
| `save.js` | localStorage save / load |
| `shots.js` | Deterministic screenshot scenes (`?shot=`) |
| `main.js` | Game loop and screen machine |

`main.ts` at the repo root copies `game/` and `screenshots/` to `/output` and
writes `/output/dossier.json` with the vendored make.fun library.

## License

MIT — see `LICENSE`. Everything in this game (city, characters, vehicles,
names, story, art, sounds) is original.
