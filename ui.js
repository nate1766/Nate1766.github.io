(() => {
  const $ = (s) => document.querySelector(s);

  class RTSApp {
    constructor(content) {
      this.content = content;
      this.game = new window.RTSGame(content, 1337);
      this.localPlayerId = 1;
      this.canvas = $('#game');
      this.renderer = new window.Renderer(this.canvas, content);
      this.keys = new Set();
      this.selection = [];
      this.attackMode = false;
      this.buildMode = null;
      this.mouse = { down: false, x: 0, y: 0, dragStart: null };
      this.acc = 0;
      this.lastTs = performance.now();
      this.resize();
      this.bind();
      requestAnimationFrame((ts) => this.frame(ts));
    }

    bind() {
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('keydown', (e) => this.onKey(e, true));
      window.addEventListener('keyup', (e) => this.onKey(e, false));
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
      this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
      window.addEventListener('mouseup', (e) => this.onMouseUp(e));
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.renderer.camera.zoom = Math.max(0.6, Math.min(1.9, this.renderer.camera.zoom - Math.sign(e.deltaY) * 0.1));
      }, { passive: false });
      $('#buildButtons').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-build]');
        if (b) this.buildMode = b.dataset.build;
      });
      $('#trainButtons').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-train]');
        if (b) this.issueTrain(b.dataset.train);
      });
      $('#minimap').addEventListener('click', (e) => this.onMinimap(e));
      $('#jumpAlert').addEventListener('click', () => {
        const p = this.game.lastAlertPos;
        if (p) this.centerCamera(p.x, p.y);
      });
    }

    onKey(e, down) {
      const k = e.key.toLowerCase();
      if (down) this.keys.add(k); else this.keys.delete(k);
      if (!down) return;
      if (k === 'a') this.attackMode = true;
      if (k === 'b') $('#buildButtons').classList.toggle('hidden');
      if (k >= '1' && k <= '9') {
        const group = Number(k);
        if (e.ctrlKey) {
          this.game.enqueueCommand({ type: 'AssignControlGroup', playerId: this.localPlayerId, group, unitIds: this.selection.slice() });
        } else {
          this.selection = this.game.controlGroups[group].slice();
          this.renderer.selection = this.selection;
        }
      }
      if (k === ' ') {
        const p = this.game.lastAlertPos;
        if (p) this.centerCamera(p.x, p.y);
      }
      if (k === 's') this.issueStop();
    }

    onMouseDown(e) {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      this.mouse.down = true;
      this.mouse.x = sx;
      this.mouse.y = sy;
      this.mouse.dragStart = { x: sx, y: sy };
      if (e.button === 2) {
        this.handleRightClick(sx, sy);
        this.mouse.down = false;
      }
    }

    onMouseMove(e) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
      if (this.mouse.down && this.mouse.dragStart) {
        const ds = this.mouse.dragStart;
        this.renderer.dragBox = { x: Math.min(ds.x, this.mouse.x), y: Math.min(ds.y, this.mouse.y), w: Math.abs(ds.x - this.mouse.x), h: Math.abs(ds.y - this.mouse.y) };
      }
    }

    onMouseUp(e) {
      if (!this.mouse.down) return;
      if (e.button !== 0) return;
      const drag = this.renderer.dragBox;
      if (drag && drag.w > 6 && drag.h > 6) {
        this.selectBox(drag, e.shiftKey);
      } else {
        this.selectSingle(this.mouse.x, this.mouse.y, e.shiftKey);
      }
      this.renderer.dragBox = null;
      this.mouse.down = false;
      this.mouse.dragStart = null;
    }

    selectSingle(sx, sy, additive) {
      const state = this.game.getVisibleState(this.localPlayerId);
      const world = this.renderer.screenToWorld(sx, sy);
      let best = null;
      let bestD = 34 * 34;
      for (const u of state.units) {
        if (u.owner !== this.localPlayerId) continue;
        const d = (u.x - world.x) ** 2 + (u.y - world.y) ** 2;
        if (d < bestD) { bestD = d; best = u.id; }
      }
      for (const s of state.structures) {
        if (s.owner !== this.localPlayerId) continue;
        const d = (s.x - world.x) ** 2 + (s.y - world.y) ** 2;
        if (d < bestD) { bestD = d; best = s.id; }
      }
      if (!additive) this.selection = [];
      if (best) {
        if (additive && this.selection.includes(best)) this.selection = this.selection.filter((id) => id !== best);
        else this.selection.push(best);
      }
      this.renderer.selection = this.selection;
      this.refreshPanels();
    }

    selectBox(box, additive) {
      const state = this.game.getVisibleState(this.localPlayerId);
      const p0 = this.renderer.screenToWorld(box.x, box.y);
      const p1 = this.renderer.screenToWorld(box.x + box.w, box.y + box.h);
      const minx = Math.min(p0.x, p1.x), maxx = Math.max(p0.x, p1.x), miny = Math.min(p0.y, p1.y), maxy = Math.max(p0.y, p1.y);
      const ids = state.units.filter((u) => u.owner === this.localPlayerId && u.x >= minx && u.x <= maxx && u.y >= miny && u.y <= maxy).map((u) => u.id);
      if (!additive) this.selection = ids;
      else this.selection = Array.from(new Set(this.selection.concat(ids)));
      this.renderer.selection = this.selection;
      this.refreshPanels();
    }

    handleRightClick(sx, sy) {
      const world = this.renderer.screenToWorld(sx, sy);
      const state = this.game.getVisibleState(this.localPlayerId);
      const targetEnemy = state.units.find((u) => u.owner !== this.localPlayerId && (u.x - world.x) ** 2 + (u.y - world.y) ** 2 < 35 * 35)
        || state.structures.find((s) => s.owner !== this.localPlayerId && (s.x - world.x) ** 2 + (s.y - world.y) ** 2 < 75 * 75);
      const resource = state.resources.find((r) => r.amount > 0 && (r.x - world.x) ** 2 + (r.y - world.y) ** 2 < (r.radius + 10) ** 2);

      if (this.buildMode) {
        const worker = state.units.find((u) => this.selection.includes(u.id) && u.type.startsWith('worker'));
        if (worker) {
          this.game.enqueueCommand({ type: 'BuildStructure', playerId: this.localPlayerId, builderId: worker.id, structureType: this.buildMode, x: Math.round(world.x), y: Math.round(world.y) });
        }
        this.buildMode = null;
        return;
      }

      if (this.attackMode && this.selection.length > 0) {
        this.game.enqueueCommand({ type: 'AttackMove', playerId: this.localPlayerId, unitIds: this.selection.slice(), x: Math.round(world.x), y: Math.round(world.y) });
        this.attackMode = false;
        return;
      }

      if (resource) {
        const workers = state.units.filter((u) => this.selection.includes(u.id) && u.type.startsWith('worker')).map((u) => u.id);
        if (workers.length > 0) this.game.enqueueCommand({ type: 'Harvest', playerId: this.localPlayerId, unitIds: workers, resourceId: resource.id });
      } else if (targetEnemy) {
        this.game.enqueueCommand({ type: 'AttackTarget', playerId: this.localPlayerId, unitIds: this.selection.slice(), targetId: targetEnemy.id });
      } else {
        this.game.enqueueCommand({ type: 'Move', playerId: this.localPlayerId, unitIds: this.selection.slice(), x: Math.round(world.x), y: Math.round(world.y) });
      }
    }

    issueTrain(unitType) {
      const state = this.game.getVisibleState(this.localPlayerId);
      const sid = this.selection.find((id) => state.structures.some((s) => s.id === id));
      if (!sid) return;
      this.game.enqueueCommand({ type: 'TrainUnit', playerId: this.localPlayerId, structureId: sid, unitType });
    }

    issueStop() {
      this.game.enqueueCommand({ type: 'Stop', playerId: this.localPlayerId, unitIds: this.selection.slice() });
    }

    onMinimap(e) {
      const c = e.currentTarget;
      const rect = c.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      this.centerCamera(x * this.game.world.width, y * this.game.world.height);
    }

    centerCamera(wx, wy) {
      this.renderer.camera.x = wx - this.renderer.viewportWidth / this.renderer.camera.zoom / 2;
      this.renderer.camera.y = wy - this.renderer.viewportHeight / this.renderer.camera.zoom / 2;
    }

    frame(ts) {
      const dt = ts - this.lastTs;
      this.lastTs = ts;
      this.acc += dt;
      this.handleCameraPan(dt);
      while (this.acc >= this.game.tickMs) {
        this.game.step();
        this.acc -= this.game.tickMs;
      }
      const state = this.game.getVisibleState(this.localPlayerId);
      this.renderer.draw(state, this.localPlayerId);
      this.drawMinimap(state);
      this.refreshTopBar(state);
      this.refreshPanels(state);
      requestAnimationFrame((n) => this.frame(n));
    }

    handleCameraPan(dt) {
      const speed = 0.8 * dt / this.renderer.camera.zoom;
      if (this.keys.has('w')) this.renderer.camera.y -= speed;
      if (this.keys.has('s')) this.renderer.camera.y += speed;
      if (this.keys.has('a')) this.renderer.camera.x -= speed;
      if (this.keys.has('d')) this.renderer.camera.x += speed;
      const margin = 16;
      if (this.mouse.x < margin) this.renderer.camera.x -= speed;
      if (this.mouse.x > this.renderer.viewportWidth - margin) this.renderer.camera.x += speed;
      if (this.mouse.y < margin) this.renderer.camera.y -= speed;
      if (this.mouse.y > this.renderer.viewportHeight - margin) this.renderer.camera.y += speed;
      this.renderer.camera.x = Math.max(0, Math.min(this.game.world.width - this.renderer.viewportWidth / this.renderer.camera.zoom, this.renderer.camera.x));
      this.renderer.camera.y = Math.max(0, Math.min(this.game.world.height - this.renderer.viewportHeight / this.renderer.camera.zoom, this.renderer.camera.y));
    }

    refreshTopBar(state) {
      const p = state.players[this.localPlayerId - 1];
      $('#res').textContent = `Minerals ${Math.floor(p.minerals)} | Gas ${Math.floor(p.gas)} | Supply ${p.supplyUsed}/${p.supplyCap}`;
      $('#alerts').innerHTML = state.alerts.slice(-3).map((a) => `<div${a.urgent ? ' class="urgent"' : ''}>${a.text}</div>`).join('');
    }

    refreshPanels(state = this.game.getVisibleState(this.localPlayerId)) {
      const selected = this.selection.map((id) => state.units.find((u) => u.id === id) || state.structures.find((s) => s.id === id)).filter(Boolean);
      $('#sel').textContent = selected.length === 0 ? 'No selection' : selected.map((x) => x.type).join(', ');
      const first = selected[0];
      const train = $('#trainButtons');
      train.innerHTML = '';
      if (first && this.content.structures[first.type]) {
        const sDef = this.content.structures[first.type];
        for (const uType of sDef.train) {
          const b = document.createElement('button');
          b.dataset.train = uType;
          b.textContent = `Train ${this.content.units[uType].name}`;
          train.appendChild(b);
        }
      }
    }

    drawMinimap(state) {
      const c = $('#minimap');
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0e1218';
      ctx.fillRect(0, 0, c.width, c.height);
      const sx = c.width / state.world.width;
      const sy = c.height / state.world.height;
      for (const r of state.resources) {
        if (r.amount <= 0) continue;
        ctx.fillStyle = r.type === 'minerals' ? '#41b8d6' : '#48d26f';
        ctx.fillRect(r.x * sx - 1, r.y * sy - 1, 2, 2);
      }
      for (const s of state.structures) {
        const col = this.content.factions[state.players[s.owner - 1].faction].color;
        ctx.fillStyle = col;
        ctx.fillRect(s.x * sx - 2, s.y * sy - 2, 4, 4);
      }
      for (const u of state.units) {
        const col = this.content.factions[state.players[u.owner - 1].faction].color;
        ctx.fillStyle = col;
        ctx.fillRect(u.x * sx, u.y * sy, 2, 2);
      }
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(this.renderer.camera.x * sx, this.renderer.camera.y * sy, this.renderer.viewportWidth / this.renderer.camera.zoom * sx, this.renderer.viewportHeight / this.renderer.camera.zoom * sy);
    }

    resize() {
      this.renderer.setViewportSize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
      this.centerCamera(900, 900);
    }
  }

  fetch('content.json')
    .then((r) => r.json())
    .then((content) => new RTSApp(content));
})();
