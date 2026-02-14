# RTS Prototype (StarCraft-like, original assets)

A single-page RTS prototype built with Vite + TypeScript + Canvas 2D.

## Features
- Deterministic fixed-step simulation core (20 ticks/sec)
- Economy: workers harvest minerals/gas and return cargo
- Supply cap + production queues
- Three asymmetric factions with different build constraints:
  - **A**: free placement, worker not consumed
  - **B**: creep required, worker consumed on building start
  - **C**: power field required for non-pylon structures
- Combat with attack-move / target attack
- Fog of war (seen vs visible)
- Selection, box select, control groups, minimap, command card, debug overlay
- Basic AI opponents

## Controls
- **Left click** select
- **Drag left** box select
- **Shift + Left click** add selection
- **Right click** context command (move / attack / harvest)
- **A** attack-move mode
- **WASD** camera pan
- **Mouse wheel** zoom
- **Ctrl+1..9** assign control group
- **1..9** recall control group
- **`** toggle debug overlay

## Development
```bash
npm install
npm run dev
```

## Build / Preview
```bash
npm run build
npm run preview
```

## GitHub Pages deployment
- Workflow: `.github/workflows/deploy.yml`
- Uses Vite build output in `dist/`
- `vite.config.ts` sets `base` automatically to `/${repo}/` for production.

## Project map
- `src/game/` deterministic simulation systems/content/commands
- `src/render/renderer.ts` canvas world rendering + fog
- `src/ui/hud.ts` SPA HUD + minimap + command card
- `src/main.ts` input, camera, loop orchestration
