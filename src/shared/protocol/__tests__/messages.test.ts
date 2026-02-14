import { describe, expect, it } from "vitest";
import type { ClientToServer, ServerToClient } from "../messages";

describe("protocol messages", () => {
  it("requires protocol version on client and server message variants", () => {
    const c2s: ClientToServer = { v: 1, t: "hello", playerName: "alpha" };
    const s2c: ServerToClient = { v: 1, t: "welcome", playerId: 7, tickRate: 20 };

    expect(c2s.v).toBe(1);
    expect(s2c.v).toBe(1);
  });
});
