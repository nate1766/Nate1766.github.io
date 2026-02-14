import type { EntityId, Vec2 } from "../types";

export interface UnitState {
  id: EntityId;
  position: Vec2;
  velocity: Vec2;
  cooldownMs: number;
}

export interface WorldState {
  tick: number;
  units: UnitState[];
}

export function cloneWorld(state: WorldState): WorldState {
  return {
    tick: state.tick,
    units: state.units.map((unit) => ({
      ...unit,
      position: { ...unit.position },
      velocity: { ...unit.velocity }
    }))
  };
}
