export type ProtocolVersion = 1;

export type PlayerCommand =
  | { k: "move"; unitIds: number[]; target: { x: number; y: number } }
  | { k: "attack"; unitIds: number[]; targetId: number };

export type EntityState = {
  id: number;
  kind: string;
  x: number;
  y: number;
  hp: number;
};

export type ClientToServer =
  | { v: ProtocolVersion; t: "hello"; playerName: string }
  | { v: ProtocolVersion; t: "cmd"; tick: number; cmd: PlayerCommand };

export type ServerToClient =
  | { v: ProtocolVersion; t: "welcome"; playerId: number; tickRate: number }
  | { v: ProtocolVersion; t: "snapshot"; tick: number; entities: EntityState[] }
  | { v: ProtocolVersion; t: "reject"; reason: string };
