# ADR-0002: MVP netcode architecture

## Context
RTS multiplayer requires fairness, anti-cheat posture, and bandwidth-conscious replication. Deterministic lockstep is efficient but has high determinism and desync tooling burden.

## Decision
For MVP, choose an authoritative server with WebSockets and snapshot replication, while preserving command-first protocol types to enable future replay/determinism enhancements.

## Alternatives considered
- Deterministic lockstep command sync only.
- Peer-hosted networking via WebRTC data channels.

## Decision drivers
- Faster implementation and debugging path for MVP.
- Better anti-cheat baseline due to server authority.
- Compatible with browser deployment constraints.

## Consequences
- Higher server CPU/bandwidth than pure lockstep.
- Need client smoothing/interpolation for network jitter.

## Revisit when
- Competitive mode, replay fidelity, or bandwidth pressure justifies partial/full lockstep migration.
