import { describe, expect, it } from 'vitest';
import { validateCommand } from '../src/game/commands';
import { createInitialState, stepGame } from '../src/game/engine';

describe('deterministic stepping', () => {
  it('stays deterministic for same seed', () => {
    const a = createInitialState(42);
    const b = createInitialState(42);
    for (let i = 0; i < 120; i++) {
      stepGame(a);
      stepGame(b);
    }
    expect(a.tick).toBe(b.tick);
    expect(a.entities.length).toBe(b.entities.length);
    expect(a.players[0].resources.minerals).toBe(b.players[0].resources.minerals);
  });
});

describe('command validation', () => {
  it('rejects unaffordable structure', () => {
    const s = createInitialState(1);
    s.players[0].resources.minerals = 0;
    expect(
      validateCommand(s, {
        tick: 1,
        playerId: 0,
        type: 'BuildStructure',
        structureType: 'barracks',
        x: 100,
        y: 100,
      }),
    ).toBe(false);
  });
});
