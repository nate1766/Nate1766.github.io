import { createWebSocketServer } from "./net/ws-server";

export function start(): void {
  createWebSocketServer();
}

start();
