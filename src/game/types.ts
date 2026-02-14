export type Faction = 'A' | 'B' | 'C';
export type EntityKind = 'unit' | 'structure' | 'resource';
export type UnitType = 'worker' | 'melee' | 'ranged' | 'heavy' | 'larva';
export type StructureType =
  | 'townhall'
  | 'supply'
  | 'barracks'
  | 'gasExtractor'
  | 'hive'
  | 'pylon';

export interface Vec2 {
  x: number;
  y: number;
}

export interface ResourceBank {
  minerals: number;
  gas: number;
  supplyUsed: number;
  supplyCap: number;
}

export interface EntityBase {
  id: number;
  owner: number;
  faction: Faction;
  kind: EntityKind;
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  vision: number;
  alive: boolean;
}

export interface Cargo {
  type: 'minerals' | 'gas' | null;
  amount: number;
}

export interface UnitEntity extends EntityBase {
  kind: 'unit';
  type: UnitType;
  speed: number;
  range: number;
  damage: number;
  cooldownTicks: number;
  cooldownLeft: number;
  targetId: number | null;
  path: Vec2[];
  order:
    | { kind: 'idle' }
    | { kind: 'move'; x: number; y: number; attackMove?: boolean }
    | { kind: 'harvest'; targetId: number }
    | { kind: 'return'; targetId: number }
    | { kind: 'attack'; targetId: number };
  cargo: Cargo;
}

export interface QueueItem {
  output: UnitType | StructureType;
  kind: 'unit' | 'structure' | 'upgrade';
  remaining: number;
}

export interface StructureEntity extends EntityBase {
  kind: 'structure';
  type: StructureType;
  buildProgress: number;
  complete: boolean;
  queue: QueueItem[];
  rally: Vec2;
  powered: boolean;
}

export interface ResourceEntity extends EntityBase {
  kind: 'resource';
  type: 'mineral' | 'geyser';
  remaining: number;
}

export type Entity = UnitEntity | StructureEntity | ResourceEntity;

export type CommandType =
  | 'Move'
  | 'AttackMove'
  | 'AttackTarget'
  | 'Stop'
  | 'Harvest'
  | 'ReturnCargo'
  | 'BuildStructure'
  | 'TrainUnit'
  | 'ResearchUpgrade'
  | 'SetRallyPoint'
  | 'AssignControlGroup'
  | 'RecallControlGroup';

export interface Command {
  tick: number;
  playerId: number;
  type: CommandType;
  unitIds?: number[];
  targetId?: number;
  x?: number;
  y?: number;
  structureType?: StructureType;
  unitType?: UnitType;
  group?: number;
}

export interface Visibility {
  seen: Uint8Array;
  visible: Uint8Array;
  width: number;
  height: number;
  cell: number;
}

export interface PlayerState {
  id: number;
  faction: Faction;
  resources: ResourceBank;
  controlGroups: Record<number, number[]>;
  lastAlert: Vec2 | null;
}

export interface MapState {
  width: number;
  height: number;
  creep: Uint8Array;
  power: Uint8Array;
  cell: number;
}

export interface GameState {
  tick: number;
  seed: number;
  rngState: number;
  nextEntityId: number;
  entities: Entity[];
  players: PlayerState[];
  map: MapState;
  commandQueue: Command[];
  visibility: Record<number, Visibility>;
  messages: string[];
}
