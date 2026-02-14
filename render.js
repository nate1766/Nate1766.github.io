(() => {
  class Renderer {
    constructor(canvas, content) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.content = content;
      this.camera = { x: 0, y: 0, zoom: 1 };
      this.selection = [];
      this.dragBox = null;
    }

    worldToScreen(x, y) {
      return { x: (x - this.camera.x) * this.camera.zoom, y: (y - this.camera.y) * this.camera.zoom };
    }

    screenToWorld(x, y) {
      return { x: x / this.camera.zoom + this.camera.x, y: y / this.camera.zoom + this.camera.y };
    }

    draw(state, localPlayerId) {
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.drawTerrain(state);
      this.drawOverlays(state);
      this.drawResources(state);
      this.drawStructures(state, localPlayerId);
      this.drawUnits(state, localPlayerId);
      this.drawProjectiles(state);
      this.drawSelection(state);
      this.drawFog(state);
      if (this.dragBox) {
        ctx.strokeStyle = '#7cc7ff';
        ctx.strokeRect(this.dragBox.x, this.dragBox.y, this.dragBox.w, this.dragBox.h);
      }
    }

    drawTerrain(state) {
      const { ctx, canvas } = this;
      ctx.fillStyle = '#1d232d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      const step = 80 * this.camera.zoom;
      const startX = (-this.camera.x * this.camera.zoom) % step;
      const startY = (-this.camera.y * this.camera.zoom) % step;
      for (let x = startX; x < canvas.width; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
      for (let y = startY; y < canvas.height; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    }

    drawOverlays(state) {
      const { ctx } = this;
      for (const s of state.structures) {
        const def = this.content.structures[s.type];
        const creep = def.creepRadius || 0;
        const power = def.powerRadius || 0;
        const p = this.worldToScreen(s.x, s.y);
        if (creep > 0) {
          ctx.fillStyle = 'rgba(128,60,180,0.15)';
          ctx.beginPath(); ctx.arc(p.x, p.y, creep * this.camera.zoom, 0, Math.PI * 2); ctx.fill();
        }
        if (power > 0) {
          ctx.fillStyle = 'rgba(250,220,120,0.13)';
          ctx.beginPath(); ctx.arc(p.x, p.y, power * this.camera.zoom, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    drawResources(state) {
      const { ctx } = this;
      for (const r of state.resources) {
        if (r.amount <= 0) continue;
        const p = this.worldToScreen(r.x, r.y);
        ctx.fillStyle = r.type === 'minerals' ? '#46d3ff' : '#57ff96';
        ctx.beginPath(); ctx.arc(p.x, p.y, r.radius * this.camera.zoom, 0, Math.PI * 2); ctx.fill();
      }
    }

    drawStructures(state) {
      const { ctx } = this;
      for (const s of state.structures) {
        const pInfo = state.players[s.owner - 1];
        const def = this.content.structures[s.type];
        const p = this.worldToScreen(s.x, s.y);
        const size = def.size * this.camera.zoom;
        ctx.fillStyle = pInfo ? this.content.factions[pInfo.faction].color : '#999';
        if (!s.complete) ctx.globalAlpha = 0.55;
        ctx.fillRect(p.x - size * 0.5, p.y - size * 0.5, size, size);
        ctx.globalAlpha = 1;
        const hpPct = Math.max(0, s.hp / def.hp);
        ctx.fillStyle = '#111';
        ctx.fillRect(p.x - size * 0.4, p.y - size * 0.62, size * 0.8, 6);
        ctx.fillStyle = '#4cff74';
        ctx.fillRect(p.x - size * 0.4, p.y - size * 0.62, size * 0.8 * hpPct, 6);
      }
    }

    drawUnits(state) {
      const { ctx } = this;
      for (const u of state.units) {
        const pInfo = state.players[u.owner - 1];
        const def = this.content.units[u.type];
        const p = this.worldToScreen(u.x, u.y);
        ctx.fillStyle = pInfo ? this.content.factions[pInfo.faction].color : '#bbb';
        ctx.beginPath(); ctx.arc(p.x, p.y, def.radius * this.camera.zoom, 0, Math.PI * 2); ctx.fill();
        const hpPct = Math.max(0, u.hp / def.hp);
        ctx.fillStyle = '#101010';
        ctx.fillRect(p.x - 16, p.y - 22, 32, 5);
        ctx.fillStyle = '#6eff8f';
        ctx.fillRect(p.x - 16, p.y - 22, 32 * hpPct, 5);
      }
    }

    drawProjectiles(state) {
      const { ctx } = this;
      ctx.fillStyle = '#ffd26d';
      for (const pjt of state.projectiles) {
        const p = this.worldToScreen(pjt.x, pjt.y);
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
    }

    drawSelection(state) {
      const { ctx } = this;
      for (const id of this.selection) {
        const u = state.units.find((x) => x.id === id) || state.structures.find((x) => x.id === id);
        if (!u) continue;
        const p = this.worldToScreen(u.x, u.y);
        const r = this.content.units[u.type]?.radius || (this.content.structures[u.type].size * 0.5);
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, (r + 5) * this.camera.zoom, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    drawFog(state) {
      const { ctx, canvas } = this;
      const fog = state.fog;
      for (let y = 0; y < fog.h; y++) {
        for (let x = 0; x < fog.w; x++) {
          const idx = y * fog.w + x;
          if (fog.visible[idx]) continue;
          const alpha = fog.explored[idx] ? 0.35 : 0.8;
          ctx.fillStyle = `rgba(0,0,0,${alpha})`;
          const sx = (x * fog.cell - this.camera.x) * this.camera.zoom;
          const sy = (y * fog.cell - this.camera.y) * this.camera.zoom;
          const s = fog.cell * this.camera.zoom + 1;
          if (sx > canvas.width || sy > canvas.height || sx + s < 0 || sy + s < 0) continue;
          ctx.fillRect(sx, sy, s, s);
        }
      }
    }
  }

  window.Renderer = Renderer;
})();
