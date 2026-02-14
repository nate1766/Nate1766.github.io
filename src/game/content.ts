import type { Faction, StructureType, UnitType } from './types';

export const TICK_RATE = 20;
export const FIXED = 1000;

export interface Cost {
  minerals: number;
  gas: number;
  supply?: number;
}

export interface UnitDef {
  speed: number;
  hp: number;
  radius: number;
  vision: number;
  range: number;
  damage: number;
  cooldown: number;
  buildTime: number;
  cost: Cost;
}

export interface StructureDef {
  hp: number;
  radius: number;
  vision: number;
  buildTime: number;
  supplyProvided?: number;
  cost: Cost;
  requiresCreep?: boolean;
  requiresPower?: boolean;
}

export const unitDefs: Record<UnitType, UnitDef> = {
  worker: {
    speed: 240,
    hp: 40,
    radius: 320,
    vision: 3600,
    range: 350,
    damage: 4,
    cooldown: 12,
    buildTime: 12,
    cost: { minerals: 50, gas: 0, supply: 1 },
  },
  melee: {
    speed: 300,
    hp: 75,
    radius: 380,
    vision: 3600,
    range: 450,
    damage: 9,
    cooldown: 16,
    buildTime: 18,
    cost: { minerals: 100, gas: 0, supply: 2 },
  },
  ranged: {
    speed: 260,
    hp: 55,
    radius: 360,
    vision: 4200,
    range: 2200,
    damage: 7,
    cooldown: 14,
    buildTime: 20,
    cost: { minerals: 90, gas: 35, supply: 2 },
  },
  heavy: {
    speed: 180,
    hp: 150,
    radius: 500,
    vision: 4200,
    range: 1400,
    damage: 18,
    cooldown: 24,
    buildTime: 34,
    cost: { minerals: 150, gas: 100, supply: 3 },
  },
  larva: {
    speed: 0,
    hp: 25,
    radius: 260,
    vision: 600,
    range: 0,
    damage: 0,
    cooldown: 0,
    buildTime: 0,
    cost: { minerals: 0, gas: 0, supply: 0 },
  },
};

export const structureDefs: Record<StructureType, StructureDef> = {
  townhall: {
    hp: 1500,
    radius: 1400,
    vision: 4600,
    buildTime: 50,
    supplyProvided: 10,
    cost: { minerals: 400, gas: 0 },
  },
  supply: {
    hp: 450,
    radius: 800,
    vision: 2600,
    buildTime: 20,
    supplyProvided: 8,
    cost: { minerals: 100, gas: 0 },
  },
  barracks: {
    hp: 1000,
    radius: 1000,
    vision: 3200,
    buildTime: 40,
    cost: { minerals: 150, gas: 0 },
  },
  gasExtractor: {
    hp: 500,
    radius: 700,
    vision: 2800,
    buildTime: 25,
    cost: { minerals: 75, gas: 0 },
  },
  hive: {
    hp: 1100,
    radius: 1200,
    vision: 3400,
    buildTime: 35,
    cost: { minerals: 220, gas: 0 },
    requiresCreep: true,
  },
  pylon: {
    hp: 360,
    radius: 760,
    vision: 3000,
    buildTime: 18,
    supplyProvided: 8,
    cost: { minerals: 100, gas: 0 },
  },
};

export const factionRules: Record<
  Faction,
  {
    requiresCreep: boolean;
    requiresPower: boolean;
    consumeWorkerOnBuild: boolean;
    townhallName: string;
  }
> = {
  A: {
    requiresCreep: false,
    requiresPower: false,
    consumeWorkerOnBuild: false,
    townhallName: 'Command Core',
  },
  B: {
    requiresCreep: true,
    requiresPower: false,
    consumeWorkerOnBuild: true,
    townhallName: 'Hive Core',
  },
  C: {
    requiresCreep: false,
    requiresPower: true,
    consumeWorkerOnBuild: false,
    townhallName: 'Temple Nexus',
  },
};
