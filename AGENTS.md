## Repo expectations
- Follow `docs/SRS.md` requirement IDs when implementing features.
- Keep TypeScript in strict mode; avoid `any`.
- Run unit tests and typecheck before finishing a change.

## Commands
- Install: `npm install`
- Dev client: `npm run dev`
- Typecheck: `npm run typecheck`
- Unit tests: `npm test`
- Build: `npm run build`

## Ownership boundaries
- `src/shared/**` defines authoritative simulation and network protocol contracts.
- `src/client/**` consumes shared contracts and implements presentation/input.
- `server/**` is authoritative for multiplayer validation and simulation hosting.

## Naming conventions
- Requirement IDs: `REQ-FUNC-###`, `REQ-SIM-###`, `REQ-NET-###`, `REQ-NFR-###`.
- Files/folders use kebab-case where practical.
- Prefer discriminated unions for network messages.

## Stop-and-ask rule
- If a requested feature conflicts with `docs/SRS.md` or changes multiplayer topology,
  stop and request requirement clarification before implementing.
