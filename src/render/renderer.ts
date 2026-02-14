import type { GameState } from '../game/types';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export class Renderer {
  ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  render(state: GameState, camera: Camera, selected: number[], debug: boolean): void {
    const { ctx } = this;
    const vw = this.canvas.width;
    const vh = this.canvas.height;
    ctx.fillStyle = '#12202a';
    ctx.fillRect(0, 0, vw, vh);

    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    this.drawGrid(state);
    this.drawOverlay(state, 'creep');
    this.drawOverlay(state, 'power');

    const vis = state.visibility[0];
    for (const e of state.entities) {
      if (!e.alive) continue;
      const idx = Math.floor(e.y / vis.cell) * vis.width + Math.floor(e.x / vis.cell);
      if (e.owner > 0 && !vis.visible[idx]) continue;
      const factionColor = e.owner === 0 ? '#4bb3fd' : e.owner === 1 ? '#eb6f6f' : '#c7a0ff';
      if (e.kind === 'resource') {
        ctx.fillStyle = e.type === 'mineral' ? '#54d2ff' : '#8fe36f';
        ctx.fillRect(e.x - e.radius / 2, e.y - e.radius / 2, e.radius, e.radius);
      } else if (e.kind === 'structure') {
        ctx.fillStyle = factionColor;
        ctx.fillRect(e.x - e.radius / 2, e.y - e.radius / 2, e.radius, e.radius);
        ctx.fillStyle = '#111';
        ctx.fillRect(e.x - e.radius / 2, e.y + e.radius / 2 + 40, e.radius, 70);
        ctx.fillStyle = '#64e291';
        ctx.fillRect(e.x - e.radius / 2, e.y + e.radius / 2 + 40, (e.hp / e.maxHp) * e.radius, 70);
      } else {
        ctx.fillStyle = factionColor;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (selected.includes(e.id)) {
        ctx.strokeStyle = '#ffe066';
        ctx.lineWidth = 70;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius / 2 + 120, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    this.drawFog(vis, state.map.width, state.map.height, state.map.cell);

    if (debug) {
      ctx.fillStyle = '#fff';
      ctx.font = '400 280px monospace';
      ctx.fillText(`Tick ${state.tick} Units ${state.entities.filter((e) => e.kind === 'unit').length}`, camera.x + 250, camera.y + 450);
    }

    ctx.restore();
  }

  private drawGrid(state: GameState): void {
    const { ctx } = this;
    ctx.strokeStyle = '#1d2b35';
    ctx.lineWidth = 40;
    for (let x = 0; x < state.map.width; x += 512) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, state.map.height);
      ctx.stroke();
    }
    for (let y = 0; y < state.map.height; y += 512) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(state.map.width, y);
      ctx.stroke();
    }
  }

  private drawOverlay(state: GameState, type: 'creep' | 'power'): void {
    const { ctx } = this;
    const data = type === 'creep' ? state.map.creep : state.map.power;
    const color = type === 'creep' ? 'rgba(168,80,190,0.18)' : 'rgba(90,180,255,0.15)';
    ctx.fillStyle = color;
    for (let i = 0; i < data.length; i++) {
      if (!data[i]) continue;
      const gx = (i % Math.ceil(state.map.width / state.map.cell)) * state.map.cell;
      const gy = Math.floor(i / Math.ceil(state.map.width / state.map.cell)) * state.map.cell;
      ctx.fillRect(gx, gy, state.map.cell, state.map.cell);
    }
  }

  private drawFog(vis: GameState['visibility'][0], width: number, height: number, cell: number): void {
    const { ctx } = this;
    for (let y = 0; y < vis.height; y++) {
      for (let x = 0; x < vis.width; x++) {
        const idx = y * vis.width + x;
        if (vis.visible[idx]) continue;
        ctx.fillStyle = vis.seen[idx] ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.8)';
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    ctx.strokeStyle = '#000';
    ctx.strokeRect(0, 0, width, height);
  }
}
