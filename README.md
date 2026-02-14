# RTS Prototype SPA (StarCraft-like gameplay, original assets)

A deterministic, browser-only RTS prototype implemented as a single-page app using vanilla JavaScript + Canvas 2D.

## Files
- `index.html` - SPA shell and HUD
- `content.json` - data-driven units, buildings, factions, costs, supply, timings
- `game.js` - deterministic simulation core and systems
- `render.js` - world rendering and fog/minimap visuals
- `ui.js` - input, selection, command issuing, camera, HUD binding

## Run locally
Because `content.json` is fetched, serve the folder over HTTP:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Controls
- **Left click**: select single unit/building
- **Left drag**: box select
- **Shift + click/drag**: add/remove selection
- **Right click**: context command
  - move on ground
  - attack if enemy under cursor
  - harvest if resource under cursor (workers)
  - place building if build mode active
- **A**: attack-move mode (next right-click target)
- **B**: toggle build command area
- **S**: stop selected units
- **WASD / edge pan**: move camera
- **Mouse wheel**: zoom
- **Ctrl + 1..9**: assign control group
- **1..9**: recall control group
- **Space**: jump to last alert

## Gameplay implemented
- Two resources: minerals + gas nodes
- Worker harvesting + return cargo loop
- Supply caps + faction-specific supply providers
- Three asymmetrical factions:
  - A: persistent worker construction
  - B: creep-gated building + worker consumed + larva-style production at Hive
  - C: power-field-gated construction + warp-in style build
- Unit production queues and rally points (internal)
- Combat with attack-move, target chasing, projectiles for ranged units
- Fog of war (visible vs explored) using low-res fog grid
- Basic AI opponents for factions B/C
- Minimap + HUD alerts

## Deploy
Deploy as static files to any host (GitHub Pages, Netlify static, S3 static site, etc.).
No backend required.

## Known limitations / next steps
- Pathing is steering-based, not full A* navigation mesh
- AI is simple and script-like
- Upgrade/research command exists in architecture but not fully surfaced in UI
- Replay persistence from command log can be added next
