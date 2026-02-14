import { FIXED, TICK_RATE, factionRules, structureDefs, unitDefs } from './content';
import type {
  Command,
  Entity,
  Faction,
  GameState,
  PlayerState,
  ResourceEntity,
  StructureEntity,
  StructureType,
  UnitEntity,
  UnitType,
  Vec2,
} from './types';

const MAP_W = 25600;
const MAP_H = 25600;
const MAP_CELL = 512;
const MAP_GW = Math.ceil(MAP_W / MAP_CELL);
const MAP_GH = Math.ceil(MAP_H / MAP_CELL);

const dist2 = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

const rngNext = (state: number): number => (state * 1664525 + 1013904223) >>> 0;

function rand(state: GameState): number {
  state.rngState = rngNext(state.rngState);
  return state.rngState / 0xffffffff;
}

function makeVisibility(): { seen: Uint8Array; visible: Uint8Array } {
  return { seen: new Uint8Array(MAP_GW * MAP_GH), visible: new Uint8Array(MAP_GW * MAP_GH) };
}

function entityById<T extends Entity>(state: GameState, id: number): T | undefined {
  return state.entities.find((e) => e.id === id && e.alive) as T | undefined;
}

function spend(p: PlayerState, minerals: number, gas: number): boolean {
  if (p.resources.minerals < minerals || p.resources.gas < gas) return false;
  p.resources.minerals -= minerals;
  p.resources.gas -= gas;
  return true;
}

function addStructure(
  state: GameState,
  owner: number,
  faction: Faction,
  type: StructureType,
  x: number,
  y: number,
  complete = true,
): StructureEntity {
  const def = structureDefs[type];
  const ent: StructureEntity = {
    id: state.nextEntityId++,
    owner,
    faction,
    kind: 'structure',
    type,
    x,
    y,
    hp: def.hp,
    maxHp: def.hp,
    radius: def.radius,
    vision: def.vision,
    alive: true,
    buildProgress: complete ? def.buildTime : 0,
    complete,
    queue: [],
    rally: { x: x + 1400, y },
    powered: false,
  };
  state.entities.push(ent);
  if (complete && def.supplyProvided) state.players[owner].resources.supplyCap += def.supplyProvided;
  return ent;
}

function addUnit(state: GameState, owner: number, faction: Faction, type: UnitType, x: number, y: number): UnitEntity {
  const def = unitDefs[type];
  const ent: UnitEntity = {
    id: state.nextEntityId++,
    owner,
    faction,
    kind: 'unit',
    type,
    x,
    y,
    hp: def.hp,
    maxHp: def.hp,
    radius: def.radius,
    vision: def.vision,
    alive: true,
    speed: def.speed,
    range: def.range,
    damage: def.damage,
    cooldownTicks: def.cooldown,
    cooldownLeft: 0,
    targetId: null,
    path: [],
    order: { kind: 'idle' },
    cargo: { type: null, amount: 0 },
  };
  state.entities.push(ent);
  if (def.cost.supply) state.players[owner].resources.supplyUsed += def.cost.supply;
  return ent;
}

function addResource(state: GameState, type: 'mineral' | 'geyser', x: number, y: number, remaining: number): void {
  const ent: ResourceEntity = {
    id: state.nextEntityId++,
    owner: -1,
    faction: 'A',
    kind: 'resource',
    type,
    x,
    y,
    hp: 1,
    maxHp: 1,
    radius: type === 'mineral' ? 600 : 900,
    vision: 0,
    alive: true,
    remaining,
  };
  state.entities.push(ent);
}

export function createInitialState(seed = 1234): GameState {
  const vis0 = makeVisibility();
  const vis1 = makeVisibility();
  const vis2 = makeVisibility();
  const players: PlayerState[] = [
    {
      id: 0,
      faction: 'A',
      resources: { minerals: 500, gas: 150, supplyUsed: 0, supplyCap: 0 },
      controlGroups: {},
      lastAlert: null,
    },
    {
      id: 1,
      faction: 'B',
      resources: { minerals: 500, gas: 150, supplyUsed: 0, supplyCap: 0 },
      controlGroups: {},
      lastAlert: null,
    },
    {
      id: 2,
      faction: 'C',
      resources: { minerals: 500, gas: 150, supplyUsed: 0, supplyCap: 0 },
      controlGroups: {},
      lastAlert: null,
    },
  ];

  const state: GameState = {
    tick: 0,
    seed,
    rngState: seed,
    nextEntityId: 1,
    entities: [],
    players,
    map: {
      width: MAP_W,
      height: MAP_H,
      creep: new Uint8Array(MAP_GW * MAP_GH),
      power: new Uint8Array(MAP_GW * MAP_GH),
      cell: MAP_CELL,
    },
    commandQueue: [],
    visibility: {
      0: { ...vis0, width: MAP_GW, height: MAP_GH, cell: MAP_CELL },
      1: { ...vis1, width: MAP_GW, height: MAP_GH, cell: MAP_CELL },
      2: { ...vis2, width: MAP_GW, height: MAP_GH, cell: MAP_CELL },
    },
    messages: [],
  };

  addStructure(state, 0, 'A', 'townhall', 3800, 3800);
  addStructure(state, 1, 'B', 'townhall', 12800, 17000);
  addStructure(state, 2, 'C', 'townhall', 21200, 5200);

  for (let i = 0; i < 8; i++) {
    addUnit(state, 0, 'A', 'worker', 3400 + i * 180, 4700 + (i % 2) * 180);
    addUnit(state, 1, 'B', 'worker', 12200 + i * 180, 17800 + (i % 2) * 180);
    addUnit(state, 2, 'C', 'worker', 20700 + i * 180, 6200 + (i % 2) * 180);
  }

  for (let i = 0; i < 16; i++) {
    addResource(state, 'mineral', 5200 + (i % 4) * 500, 3300 + Math.floor(i / 4) * 500, 1500);
    addResource(state, 'mineral', 14200 + (i % 4) * 500, 16000 + Math.floor(i / 4) * 500, 1500);
    addResource(state, 'mineral', 22600 + (i % 4) * 500, 4700 + Math.floor(i / 4) * 500, 1500);
  }
  addResource(state, 'geyser', 6400, 5200, 5000);
  addResource(state, 'geyser', 15600, 18400, 5000);
  addResource(state, 'geyser', 24200, 7000, 5000);

  state.messages.push('Match started');
  return state;
}

export function enqueueCommand(state: GameState, command: Omit<Command, 'tick'>): void {
  state.commandQueue.push({ ...command, tick: state.tick + 1 });
}

function canPlace(state: GameState, playerId: number, type: StructureType, x: number, y: number): boolean {
  const player = state.players[playerId];
  const idx = Math.floor(y / MAP_CELL) * MAP_GW + Math.floor(x / MAP_CELL);
  if (idx < 0 || idx >= state.map.creep.length) return false;
  if (player.faction === 'B' && !state.map.creep[idx]) return false;
  if (player.faction === 'C' && type !== 'pylon' && !state.map.power[idx]) return false;
  return !state.entities.some((e) => e.alive && e.kind !== 'resource' && dist2(e, { x, y }) < (e.radius + structureDefs[type].radius) ** 2);
}

function applyCommands(state: GameState): void {
  const commands = state.commandQueue.filter((c) => c.tick === state.tick);
  for (const c of commands) {
    const player = state.players[c.playerId];
    if (!player) continue;
    const units = (c.unitIds ?? []).map((id) => entityById<UnitEntity>(state, id)).filter((u): u is UnitEntity => !!u && u.owner === c.playerId);

    switch (c.type) {
      case 'Move':
      case 'AttackMove':
        if (c.x === undefined || c.y === undefined) break;
        for (const u of units) u.order = { kind: 'move', x: c.x, y: c.y, attackMove: c.type === 'AttackMove' };
        break;
      case 'Stop':
        for (const u of units) u.order = { kind: 'idle' };
        break;
      case 'Harvest': {
        if (!c.targetId) break;
        const target = entityById<ResourceEntity>(state, c.targetId);
        if (!target) break;
        for (const u of units.filter((v) => v.type === 'worker')) u.order = { kind: 'harvest', targetId: target.id };
        break;
      }
      case 'AttackTarget': {
        if (!c.targetId) break;
        for (const u of units) u.order = { kind: 'attack', targetId: c.targetId };
        break;
      }
      case 'BuildStructure': {
        if (!c.structureType || c.x === undefined || c.y === undefined || units.length === 0) break;
        const def = structureDefs[c.structureType];
        if (!spend(player, def.cost.minerals, def.cost.gas)) break;
        if (!canPlace(state, c.playerId, c.structureType, c.x, c.y)) {
          player.resources.minerals += def.cost.minerals;
          player.resources.gas += def.cost.gas;
          break;
        }
        addStructure(state, c.playerId, player.faction, c.structureType, c.x, c.y, false);
        const worker = units[0];
        if (factionRules[player.faction].consumeWorkerOnBuild) {
          worker.alive = false;
          player.resources.supplyUsed -= 1;
        } else {
          worker.order = { kind: 'move', x: c.x, y: c.y };
        }
        break;
      }
      case 'TrainUnit': {
        if (!c.targetId || !c.unitType) break;
        const building = entityById<StructureEntity>(state, c.targetId);
        if (!building || building.owner !== c.playerId || !building.complete) break;
        const def = unitDefs[c.unitType];
        const supplyNeed = def.cost.supply ?? 0;
        if (player.resources.supplyUsed + supplyNeed > player.resources.supplyCap) break;
        if (!spend(player, def.cost.minerals, def.cost.gas)) break;
        building.queue.push({ output: c.unitType, kind: 'unit', remaining: def.buildTime * TICK_RATE });
        break;
      }
      case 'SetRallyPoint': {
        if (!c.targetId || c.x === undefined || c.y === undefined) break;
        const building = entityById<StructureEntity>(state, c.targetId);
        if (building && building.owner === c.playerId) building.rally = { x: c.x, y: c.y };
        break;
      }
      case 'AssignControlGroup': {
        if (!c.group) break;
        player.controlGroups[c.group] = units.map((u) => u.id);
        break;
      }
      case 'RecallControlGroup':
      case 'ReturnCargo':
      case 'ResearchUpgrade':
        break;
    }
  }
}

function moveToward(unit: UnitEntity, tx: number, ty: number): void {
  const dx = tx - unit.x;
  const dy = ty - unit.y;
  const d = Math.hypot(dx, dy);
  if (d < 10) return;
  const step = unit.speed;
  const s = Math.min(step, d) / d;
  unit.x += Math.round(dx * s);
  unit.y += Math.round(dy * s);
}

function runEconomy(state: GameState): void {
  const halls = state.entities.filter((e): e is StructureEntity => e.kind === 'structure' && e.type === 'townhall' && e.complete && e.alive);
  const resources = state.entities.filter((e): e is ResourceEntity => e.kind === 'resource' && e.alive);
  for (const unit of state.entities.filter((e): e is UnitEntity => e.kind === 'unit' && e.type === 'worker' && e.alive)) {
    if (unit.order.kind === 'harvest') {
      const node = entityById<ResourceEntity>(state, unit.order.targetId);
      if (!node || node.remaining <= 0) {
        unit.order = { kind: 'idle' };
        continue;
      }
      if (dist2(unit, node) > (unit.radius + node.radius + 100) ** 2) {
        moveToward(unit, node.x, node.y);
      } else {
        const amt = node.type === 'mineral' ? 5 : 4;
        unit.cargo.amount = Math.min(10, unit.cargo.amount + amt);
        unit.cargo.type = node.type === 'mineral' ? 'minerals' : 'gas';
        node.remaining -= amt;
        const hall = halls.find((h) => h.owner === unit.owner);
        if (unit.cargo.amount >= 10 && hall) unit.order = { kind: 'return', targetId: hall.id };
      }
    } else if (unit.order.kind === 'return') {
      const hall = entityById<StructureEntity>(state, unit.order.targetId);
      if (!hall || hall.owner !== unit.owner) {
        unit.order = { kind: 'idle' };
        continue;
      }
      if (dist2(unit, hall) > (unit.radius + hall.radius + 100) ** 2) {
        moveToward(unit, hall.x, hall.y);
      } else {
        const p = state.players[unit.owner];
        if (unit.cargo.type === 'minerals') p.resources.minerals += unit.cargo.amount;
        if (unit.cargo.type === 'gas') p.resources.gas += unit.cargo.amount;
        unit.cargo.amount = 0;
        unit.cargo.type = null;
        const nearby = resources.find((r) => dist2(hall, r) < 5000 ** 2 && r.remaining > 0);
        if (nearby) unit.order = { kind: 'harvest', targetId: nearby.id };
        else unit.order = { kind: 'idle' };
      }
    }
  }
}

function runProduction(state: GameState): void {
  state.map.creep.fill(0);
  state.map.power.fill(0);
  const gw = MAP_GW;
  for (const s of state.entities.filter((e): e is StructureEntity => e.kind === 'structure' && e.alive)) {
    if (!s.complete) {
      s.buildProgress += 1;
      if (s.buildProgress >= structureDefs[s.type].buildTime * TICK_RATE) {
        s.complete = true;
        const sup = structureDefs[s.type].supplyProvided;
        if (sup) state.players[s.owner].resources.supplyCap += sup;
        state.messages.push(`${s.type} complete`);
      }
    }
    const radCells = Math.floor((s.radius * 2.2) / MAP_CELL);
    for (let oy = -radCells; oy <= radCells; oy++) {
      for (let ox = -radCells; ox <= radCells; ox++) {
        const cx = Math.floor(s.x / MAP_CELL) + ox;
        const cy = Math.floor(s.y / MAP_CELL) + oy;
        if (cx < 0 || cy < 0 || cx >= MAP_GW || cy >= MAP_GH) continue;
        const idx = cy * gw + cx;
        if (s.faction === 'B') state.map.creep[idx] = 1;
        if (s.type === 'pylon') state.map.power[idx] = 1;
      }
    }
    if (s.complete && s.queue.length > 0) {
      const q = s.queue[0];
      q.remaining -= 1;
      if (q.remaining <= 0) {
        if (q.kind === 'unit') addUnit(state, s.owner, s.faction, q.output as UnitType, s.x + 900, s.y + 600);
        s.queue.shift();
      }
    }
  }
}

function runCombat(state: GameState): void {
  const units = state.entities.filter((e): e is UnitEntity => e.kind === 'unit' && e.alive);
  for (const u of units) {
    if (u.cooldownLeft > 0) u.cooldownLeft--;
    if (u.order.kind === 'move') {
      moveToward(u, u.order.x, u.order.y);
      if (u.order.attackMove) {
        const enemy = units.find((e) => e.owner !== u.owner && dist2(e, u) < u.vision * u.vision);
        if (enemy) u.order = { kind: 'attack', targetId: enemy.id };
      }
      continue;
    }
    if (u.order.kind === 'attack') {
      const t = entityById<UnitEntity | StructureEntity>(state, u.order.targetId);
      if (!t || t.owner === u.owner || !t.alive) {
        u.order = { kind: 'idle' };
        continue;
      }
      const reach = u.range + u.radius + t.radius;
      if (dist2(u, t) > reach * reach) moveToward(u, t.x, t.y);
      else if (u.cooldownLeft === 0) {
        t.hp -= u.damage;
        u.cooldownLeft = u.cooldownTicks;
        if (t.hp <= 0) {
          t.alive = false;
          state.players[t.owner].lastAlert = { x: t.x, y: t.y };
        }
      }
    }
  }
}

function runVision(state: GameState): void {
  for (const p of state.players) {
    const vis = state.visibility[p.id];
    vis.visible.fill(0);
    for (const e of state.entities) {
      if (!e.alive || e.owner !== p.id) continue;
      const rad = Math.floor(e.vision / vis.cell);
      const cx = Math.floor(e.x / vis.cell);
      const cy = Math.floor(e.y / vis.cell);
      for (let y = -rad; y <= rad; y++) {
        for (let x = -rad; x <= rad; x++) {
          const gx = cx + x;
          const gy = cy + y;
          if (gx < 0 || gy < 0 || gx >= vis.width || gy >= vis.height) continue;
          const idx = gy * vis.width + gx;
          vis.visible[idx] = 1;
          vis.seen[idx] = 1;
        }
      }
    }
  }
}

function runAi(state: GameState): void {
  if (state.tick % (TICK_RATE * 3) !== 0) return;
  for (const player of state.players.slice(1)) {
    const townhall = state.entities.find(
      (e): e is StructureEntity => e.kind === 'structure' && e.owner === player.id && e.type === 'townhall' && e.alive,
    );
    if (!townhall) continue;
    const workers = state.entities.filter((e): e is UnitEntity => e.kind === 'unit' && e.owner === player.id && e.type === 'worker' && e.alive);
    const idleWorker = workers.find((w) => w.order.kind === 'idle');
    if (idleWorker) {
      const node = state.entities.find(
        (e): e is ResourceEntity => e.kind === 'resource' && e.remaining > 0 && dist2(e, townhall) < 8000 ** 2,
      );
      if (node) idleWorker.order = { kind: 'harvest', targetId: node.id };
    }
    if (townhall.queue.length < 2 && rand(state) > 0.4) {
      state.commandQueue.push({ tick: state.tick + 1, playerId: player.id, type: 'TrainUnit', targetId: townhall.id, unitType: 'worker' });
    }
    const army = state.entities.filter((e): e is UnitEntity => e.kind === 'unit' && e.owner === player.id && e.type !== 'worker' && e.alive);
    if (army.length >= 8) {
      const enemyHall = state.entities.find((e): e is StructureEntity => e.kind === 'structure' && e.owner === 0 && e.type === 'townhall' && e.alive);
      if (enemyHall) {
        for (const u of army) u.order = { kind: 'attack', targetId: enemyHall.id };
      }
    }
  }
}

export function stepGame(state: GameState): void {
  state.tick += 1;
  applyCommands(state);
  runAi(state);
  runEconomy(state);
  runProduction(state);
  runCombat(state);
  runVision(state);
  state.entities = state.entities.filter((e) => e.alive || e.kind === 'resource');
  if (state.messages.length > 8) state.messages.shift();
}

export class GameLoop {
  state: GameState;
  accumulator = 0;
  readonly tickMs = 1000 / TICK_RATE;

  constructor(seed = 1234) {
    this.state = createInitialState(seed);
  }

  update(deltaMs: number): number {
    this.accumulator += deltaMs;
    while (this.accumulator >= this.tickMs) {
      stepGame(this.state);
      this.accumulator -= this.tickMs;
    }
    return this.accumulator / this.tickMs;
  }

  reset(seed = 1234): void {
    this.state = createInitialState(seed);
    this.accumulator = 0;
  }

  worldToCell(_x: number, y: number): number {
    return Math.floor(y / FIXED);
  }
}
