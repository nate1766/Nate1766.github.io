import { cloneWorld, type WorldState } from "./world";

export function stepWorld(state: WorldState, dtMs: number): WorldState {
  const next = cloneWorld(state);
  next.tick += 1;

  for (const unit of next.units) {
    unit.position.x += unit.velocity.x * (dtMs / 1000);
    unit.position.y += unit.velocity.y * (dtMs / 1000);
    unit.cooldownMs = Math.max(0, unit.cooldownMs - dtMs);
  }

  return next;
}
