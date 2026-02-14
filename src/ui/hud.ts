import type { Command, GameState, StructureEntity, UnitEntity } from '../game/types';

export class Hud {
  root: HTMLDivElement;
  resources = document.createElement('div');
  selection = document.createElement('div');
  commands = document.createElement('div');
  messages = document.createElement('div');
  minimap = document.createElement('canvas');
  resetBtn = document.createElement('button');

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;inset:0;pointer-events:none;color:#dce7f5;font:13px system-ui;display:grid;grid-template-rows:auto 1fr auto;';

    const top = document.createElement('div');
    top.style.cssText = 'display:flex;justify-content:space-between;padding:8px;background:rgba(0,0,0,0.3);';
    this.resources.style.pointerEvents = 'auto';
    this.resetBtn.textContent = 'Reset Match';
    this.resetBtn.style.pointerEvents = 'auto';
    top.append(this.resources, this.resetBtn);

    const bottom = document.createElement('div');
    bottom.style.cssText =
      'display:grid;grid-template-columns:280px 1fr 280px;gap:8px;padding:8px;background:rgba(0,0,0,0.38);align-items:end;';
    this.selection.style.cssText = 'min-height:120px;background:rgba(9,14,20,0.8);padding:8px;';
    this.commands.style.cssText = 'min-height:120px;background:rgba(9,14,20,0.8);padding:8px;pointer-events:auto;display:flex;gap:6px;flex-wrap:wrap;';
    this.messages.style.cssText = 'min-height:120px;background:rgba(9,14,20,0.8);padding:8px;';
    bottom.append(this.selection, this.commands, this.messages);

    this.minimap.width = 220;
    this.minimap.height = 220;
    this.minimap.style.cssText = 'position:fixed;right:12px;bottom:148px;border:1px solid #557;background:#111;pointer-events:auto;';

    this.root.append(top, document.createElement('div'), bottom, this.minimap);
    parent.append(this.root);
  }

  render(
    state: GameState,
    selectedUnits: UnitEntity[],
    selectedBuilding: StructureEntity | null,
    onCommand: (command: Omit<Command, 'tick'>) => void,
  ): void {
    const p = state.players[0].resources;
    this.resources.textContent = `Minerals ${p.minerals}   Gas ${p.gas}   Supply ${p.supplyUsed}/${p.supplyCap}`;

    this.selection.innerHTML = `<b>Selection</b><br/>${selectedUnits
      .slice(0, 8)
      .map((u) => `${u.type} HP:${u.hp}/${u.maxHp} ${u.order.kind}`)
      .join('<br/>')}${selectedBuilding ? `<br/>${selectedBuilding.type} Queue:${selectedBuilding.queue.length}` : ''}`;

    this.commands.innerHTML = '';
    const mk = (label: string, fn: () => void): void => {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = fn;
      this.commands.append(b);
    };
    if (selectedUnits.length > 0) {
      mk('Stop', () => onCommand({ playerId: 0, type: 'Stop', unitIds: selectedUnits.map((u) => u.id) }));
    }
    const workers = selectedUnits.filter((u) => u.type === 'worker');
    if (workers.length > 0) {
      mk('Build Supply', () => onCommand({ playerId: 0, type: 'BuildStructure', unitIds: [workers[0].id], structureType: 'supply', x: workers[0].x + 900, y: workers[0].y }));
      mk('Build Barracks', () => onCommand({ playerId: 0, type: 'BuildStructure', unitIds: [workers[0].id], structureType: 'barracks', x: workers[0].x + 1200, y: workers[0].y + 350 }));
      mk('Build Pylon', () => onCommand({ playerId: 0, type: 'BuildStructure', unitIds: [workers[0].id], structureType: 'pylon', x: workers[0].x + 700, y: workers[0].y + 700 }));
      mk('Build Hive', () => onCommand({ playerId: 0, type: 'BuildStructure', unitIds: [workers[0].id], structureType: 'hive', x: workers[0].x + 1000, y: workers[0].y + 600 }));
    }
    if (selectedBuilding) {
      mk('Train Worker', () => onCommand({ playerId: 0, type: 'TrainUnit', targetId: selectedBuilding.id, unitType: 'worker' }));
      mk('Train Melee', () => onCommand({ playerId: 0, type: 'TrainUnit', targetId: selectedBuilding.id, unitType: 'melee' }));
      mk('Train Ranged', () => onCommand({ playerId: 0, type: 'TrainUnit', targetId: selectedBuilding.id, unitType: 'ranged' }));
      mk('Train Heavy', () => onCommand({ playerId: 0, type: 'TrainUnit', targetId: selectedBuilding.id, unitType: 'heavy' }));
    }

    this.messages.innerHTML = `<b>Messages</b><br/>${state.messages.slice(-6).join('<br/>')}`;
    this.drawMinimap(state);
  }

  private drawMinimap(state: GameState): void {
    const ctx = this.minimap.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0a0b0d';
    ctx.fillRect(0, 0, this.minimap.width, this.minimap.height);
    const sx = this.minimap.width / state.map.width;
    const sy = this.minimap.height / state.map.height;
    const vis = state.visibility[0];
    for (let y = 0; y < vis.height; y++) {
      for (let x = 0; x < vis.width; x++) {
        const idx = y * vis.width + x;
        if (!vis.seen[idx]) continue;
        ctx.fillStyle = vis.visible[idx] ? '#1d2a3b' : '#141414';
        ctx.fillRect(x * vis.cell * sx, y * vis.cell * sy, vis.cell * sx, vis.cell * sy);
      }
    }
    for (const e of state.entities) {
      if (!e.alive || e.kind === 'resource') continue;
      ctx.fillStyle = e.owner === 0 ? '#5ac8fa' : e.owner === 1 ? '#ff5d5d' : '#d49eff';
      ctx.fillRect(e.x * sx, e.y * sy, 3, 3);
    }
  }
}
