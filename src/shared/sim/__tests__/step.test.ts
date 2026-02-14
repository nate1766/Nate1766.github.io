import { describe, expect, it } from "vitest";
import { stepWorld } from "../step";
import type { WorldState } from "../world";

const initial: WorldState = {
  tick: 0,
  units: [
    {
      id: 1,
      position: { x: 0, y: 0 },
      velocity: { x: 2, y: -1 },
      cooldownMs: 250
    }
  ]
};

describe("stepWorld", () => {
  it("advances position and cooldown at fixed dt", () => {
    const next = stepWorld(initial, 50);
    expect(next.tick).toBe(1);
    expect(next.units[0].position.x).toBeCloseTo(0.1);
    expect(next.units[0].position.y).toBeCloseTo(-0.05);
    expect(next.units[0].cooldownMs).toBe(200);
  });

  it("is deterministic for identical input", () => {
    const runA = stepWorld(initial, 50);
    const runB = stepWorld(initial, 50);
    expect(runA).toEqual(runB);
  });
});
