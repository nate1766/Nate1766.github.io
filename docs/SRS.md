# Software Requirements Specification (Browser RTS MVP)

## 1. Scope and goals
- Build a browser-based RTS with original universe/art/audio and inspired-by mechanics only.
- MVP scope: 1v1 multiplayer, desktop browsers, 2D top-down presentation, authoritative server over WebSockets.
- Out of scope for MVP: ranked ladder, spectator mode, map editor, monetization.

## 2. Assumptions and constraints
- TBD: final target browsers and minimum hardware profile.
- Target unit scale: up to ~50 active units per player in MVP.
- Multiplayer authority remains server-side for rule validation.

## 3. Functional requirements
- **REQ-FUNC-001 (Selection):** The client SHALL support single-click and drag-box multi-selection for friendly units.
- **REQ-FUNC-002 (Move command):** The player SHALL be able to issue move commands to selected units using right-click.
- **REQ-FUNC-003 (Basic economy):** The game SHALL provide at least one collectible resource and one spend action.

## 4. Simulation requirements
- **REQ-SIM-001 (Fixed tick):** Simulation SHALL advance at a fixed tick rate independent of render frame rate.
- **REQ-SIM-002 (Determinism baseline):** Given identical initial state and command stream, simulation results SHALL match for at least 600 ticks.
- **REQ-SIM-010 (Fog of war):** Enemy units SHALL be visible only when within current vision rules of friendly forces.

## 5. Networking requirements
- **REQ-NET-001 (Transport):** Multiplayer sessions SHALL use WebSockets between browser client and game server.
- **REQ-NET-002 (Authoritative validation):** Server SHALL validate and apply player commands before state replication.
- **REQ-NET-003 (Protocol versioning):** Every network message SHALL carry a protocol version field.

## 6. Non-functional requirements
- **REQ-NFR-001 (Responsiveness):** Input-to-visible-feedback latency SHOULD be under 100 ms in local testing.
- **REQ-NFR-002 (Performance):** Client SHOULD sustain 60 FPS on target desktop profile for MVP unit counts.
- **REQ-NFR-003 (Quality gates):** CI SHALL run typecheck, unit tests, and build on every push.

## 7. Verification mapping
- REQ-SIM-001, REQ-SIM-002 verified by `src/shared/sim/__tests__/step.test.ts`.
- REQ-NET-003 verified by `src/shared/protocol/__tests__/messages.test.ts`.
- REQ-NFR-003 verified by `.github/workflows/ci.yml`.

## 8. Glossary
- **Tick:** discrete simulation step.
- **Snapshot:** serialized world state emitted by the server.
- **Command:** player action intent (move/attack/build).
- **Entity:** unit/building/resource object tracked by simulation.
