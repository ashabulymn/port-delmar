[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ashabulymn/port-delmar/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ashabulymn/port-delmar/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Port Delmar

An open-world crime game in the spirit of GTA 6, built by an AI agent for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01) ($1,666 in USDC). A 2D top-down open world you explore on foot and by car:
traffic and pedestrians, cars to steal, a wanted level with police who chase
you, five story missions, combat, a HUD with a minimap, a start screen and a
save. Everything — city, characters, vehicles, names, story, art, sound and
music — is original.

## Play

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

## Controls

- **WASD / arrows** — walk or drive
- **Shift** — run on foot
- **E** — get in / out of a car (steal it if it is not yours)
- **F** — punch
- **Space** — shoot (once you have the pistol)
- **P / Esc** — pause
- **M** — music on/off
- **Enter / click** — start, confirm

## Story

Rook, a driver for hire in Port Delmar, takes jobs from Mama Lou. Five
missions: a first fare, a stolen Comet GT, an alley pickup, a hot delivery
under a two-star wanted level, and the big getaway to the pier.

## Files

- `main.ts` — hands game/ and screenshots/ to /output with dossier.json
- `game/index.html` — the page; `game/src/` — the game, ES modules, no libraries
- `screenshots/` — 3–4 real renders of the game (see shots.json)

## Screenshots

Real renders of the game, taken in headless Chrome:

- `screenshots/1-start.jpg` — the start screen
- `screenshots/2-drive.jpg` — driving through the city
- `screenshots/3-chase.jpg` — a police chase at wanted level
- `screenshots/4-mission.jpg` — a story mission in progress
