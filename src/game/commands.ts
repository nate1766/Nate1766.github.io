import { structureDefs, unitDefs } from './content';
import type { Command, GameState, StructureEntity } from './types';

export function validateCommand(state: GameState, command: Command): boolean {
  const player = state.players[command.playerId];
  if (!player) return false;
  if (command.type === 'BuildStructure') {
    if (!command.structureType || command.x === undefined || command.y === undefined) return false;
    const def = structureDefs[command.structureType];
    return player.resources.minerals >= def.cost.minerals && player.resources.gas >= def.cost.gas;
  }
  if (command.type === 'TrainUnit') {
    if (!command.targetId || !command.unitType) return false;
    const building = state.entities.find(
      (e): e is StructureEntity => e.kind === 'structure' && e.id === command.targetId && e.owner === command.playerId,
    );
    if (!building?.complete) return false;
    const unit = unitDefs[command.unitType];
    const s = unit.cost.supply ?? 0;
    return (
      player.resources.minerals >= unit.cost.minerals &&
      player.resources.gas >= unit.cost.gas &&
      player.resources.supplyUsed + s <= player.resources.supplyCap
    );
  }
  return true;
}
