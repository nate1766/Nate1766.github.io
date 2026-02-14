# Browser RTS MVP Scaffold (Static Vanilla JS)

This repository now runs as a **single-page vanilla JavaScript** RTS prototype that can be hosted directly on GitHub Pages as static files.

## Run locally (no build required)

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Optional tooling checks

```bash
npm install
npm run typecheck
npm test
npm run build
npm run validate:data
```

## Structure

- `index.html`: SPA shell + HUD.
- `src/client/*.js`: vanilla JS game loop, input handling, and canvas rendering.
- `src/shared/*`: shared TypeScript simulation/protocol scaffolding for future networking milestones.
- `docs/SRS.md` and `docs/ADR/*`: requirements and architecture decisions.
