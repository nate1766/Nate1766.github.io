# ADR-0001: Fixed-timestep engine loop

## Context
Browser render cadence is variable while RTS simulation needs stable step boundaries for predictable gameplay and future replay support.

## Decision
Use a fixed simulation timestep (default 20 TPS) with an accumulator-based game loop on the client and matching discrete ticks on the server.

## Decision drivers
- Determinism-friendly update boundaries.
- Simplified testability for simulation logic.
- Clear separation of render and simulation responsibilities.

## Consequences
- Sim updates may run multiple times per render frame under lag.
- Rendering interpolates from latest known state rather than driving rules.

## Revisit when
- Unit counts or networking demands require variable-rate sub-stepping or hybrid interpolation schemes.
