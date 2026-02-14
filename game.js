(() => {
  const FP = 100;
  const clamp = (v, min, max) => (v < min ? min : (v > max ? max : v));
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  };

  class RNG {
    constructor(seed) { this.state = seed | 0; }
    nextInt() { this.state = (Math.imul(1664525, this.state) + 1013904223) | 0; return this.state >>> 0; }
    nextFloat() { return this.nextInt() / 4294967296; }
  }

  function makeFog(playerId, worldW, worldH, cell) {
    const w = Math.ceil(worldW / cell);
    const h = Math.ceil(worldH / cell);
    return { cell, w, h, visible: new Uint8Array(w * h), explored: new Uint8Array(w * h), playerId };
  }

  class RTSGame {
    constructor(content, seed = 1337) {
      this.content = content;
      this.tickRate = content.config.tickRate;
      this.tickMs = 1000 / this.tickRate;
      this.world = content.config.world;
      this.rng = new RNG(seed);
      this.nextId = 1;
      this.tick = 0;
      this.commandQueue = [];
      this.alerts = [];
      this.lastAlertPos = null;
      this.controlGroups = Array.from({ length: 10 }, () => []);
      this.players = this.initPlayers();
      this.units = [];
      this.structures = [];
      this.resources = [];
      this.projectiles = [];
      this.pathGrid = new Uint8Array(Math.ceil(this.world.width / this.world.cell) * Math.ceil(this.world.height / this.world.cell));
      this.createMap();
      this.spawnStartingBases();
    }

    initPlayers() {
      const fogCell = this.content.config.fog.cell;
      return [
        { id: 1, faction: 'A', minerals: 500, gas: 0, supplyUsed: 0, supplyCap: 0, fog: makeFog(1, this.world.width, this.world.height, fogCell), ai: false },
        { id: 2, faction: 'B', minerals: 500, gas: 0, supplyUsed: 0, supplyCap: 0, fog: makeFog(2, this.world.width, this.world.height, fogCell), ai: true },
        { id: 3, faction: 'C', minerals: 500, gas: 0, supplyUsed: 0, supplyCap: 0, fog: makeFog(3, this.world.width, this.world.height, fogCell), ai: true }
      ];
    }

    createMap() {
      const spots = [
        [900, 900], [5500, 900], [3200, 5500]
      ];
      spots.forEach(([x, y], idx) => {
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * 2 * i) / 8;
          this.resources.push({ id: this.nextId++, type: 'minerals', x: x + Math.cos(a) * 260, y: y + Math.sin(a) * 220, amount: 1200, radius: 36 });
        }
        this.resources.push({ id: this.nextId++, type: 'gas', x: x + 320, y: y + 80, amount: 3500, radius: 52, occupiedBy: null });
      });
      for (let i = 0; i < 14; i++) {
        this.resources.push({
          id: this.nextId++, type: 'minerals', x: 1000 + this.rng.nextFloat() * 4400, y: 1000 + this.rng.nextFloat() * 4400, amount: 700, radius: 32
        });
      }
    }

    spawnStartingBases() {
      const spawn = { 1: [900, 900], 2: [5500, 900], 3: [3200, 5500] };
      for (const p of this.players) {
        const factionDef = this.content.factions[p.faction];
        const [sx, sy] = spawn[p.id];
        const townHallType = factionDef.townHall;
        this.addStructure(p.id, townHallType, sx, sy, true, null);
        for (let i = 0; i < 6; i++) {
          this.addUnit(p.id, factionDef.worker, sx + 180 + i * 22, sy + 30 + (i % 2) * 22);
        }
        if (p.faction === 'A') this.addStructure(p.id, 'barracks', sx + 210, sy - 200, false, null);
        if (p.faction === 'C') this.addStructure(p.id, 'pylon', sx + 220, sy - 170, false, null);
      }
      this.recomputeSupply();
    }

    addUnit(owner, type, x, y) {
      const def = this.content.units[type];
      const u = {
        id: this.nextId++, owner, type, x: Math.round(x), y: Math.round(y), px: Math.round(x), py: Math.round(y), hp: def.hp, cooldown: 0,
        order: { type: 'idle' }, targetId: null, moveTargetX: x, moveTargetY: y, cargoType: null, cargoAmount: 0, pathRecalc: 0
      };
      this.units.push(u);
      return u;
    }

    addStructure(owner, type, x, y, completed = false, builderId = null) {
      const def = this.content.structures[type];
      const s = {
        id: this.nextId++, owner, type, x: Math.round(x), y: Math.round(y), hp: completed ? def.hp : 1,
        buildProgress: completed ? def.buildTime : 0, buildTime: def.buildTime, complete: completed || def.buildTime === 0,
        queue: [], rallyX: x + 130, rallyY: y + 130, builderId, larva: def.larvaMax || 0, larvaTicker: 0
      };
      this.structures.push(s);
      this.rebuildPathGrid();
      this.recomputeSupply();
      return s;
    }

    getById(id) {
      for (const u of this.units) if (u.id === id) return u;
      for (const s of this.structures) if (s.id === id) return s;
      for (const r of this.resources) if (r.id === id) return r;
      return null;
    }

    enqueueCommand(cmd) { this.commandQueue.push(cmd); }

    step() {
      this.tick++;
      this.applyCommands();
      this.productionSystem();
      this.economySystem();
      this.combatSystem();
      this.pathSystem();
      this.visionSystem();
      this.aiSystem();
      this.cleanupSystem();
    }

    applyCommands() {
      const cmds = this.commandQueue;
      this.commandQueue = [];
      for (const cmd of cmds) {
        const p = this.players.find((pl) => pl.id === cmd.playerId);
        if (!p) continue;
        if (cmd.type === 'Move' || cmd.type === 'AttackMove') {
          for (const id of cmd.unitIds) {
            const u = this.units.find((x) => x.id === id && x.owner === p.id);
            if (!u) continue;
            u.order = { type: cmd.type === 'Move' ? 'move' : 'attackMove', x: cmd.x, y: cmd.y };
          }
        } else if (cmd.type === 'AttackTarget') {
          const target = this.getById(cmd.targetId);
          if (!target) continue;
          for (const id of cmd.unitIds) {
            const u = this.units.find((x) => x.id === id && x.owner === p.id);
            if (u) u.order = { type: 'attackTarget', targetId: cmd.targetId };
          }
        } else if (cmd.type === 'Stop') {
          for (const id of cmd.unitIds) {
            const u = this.units.find((x) => x.id === id && x.owner === p.id);
            if (u) u.order = { type: 'idle' };
          }
        } else if (cmd.type === 'Harvest') {
          const node = this.resources.find((r) => r.id === cmd.resourceId);
          if (!node) continue;
          for (const id of cmd.unitIds) {
            const u = this.units.find((x) => x.id === id && x.owner === p.id);
            if (u && u.type.startsWith('worker')) u.order = { type: 'harvest', resourceId: node.id };
          }
        } else if (cmd.type === 'ReturnCargo') {
          for (const id of cmd.unitIds) {
            const u = this.units.find((x) => x.id === id && x.owner === p.id);
            if (u && u.cargoAmount > 0) u.order = { type: 'returnCargo' };
          }
        } else if (cmd.type === 'BuildStructure') {
          this.handleBuildStructure(p, cmd);
        } else if (cmd.type === 'TrainUnit') {
          this.handleTrainUnit(p, cmd.structureId, cmd.unitType);
        } else if (cmd.type === 'ResearchUpgrade') {
          // Scaffold for future tech system.
        } else if (cmd.type === 'SetRallyPoint') {
          const s = this.structures.find((x) => x.id === cmd.structureId && x.owner === p.id);
          if (s) { s.rallyX = cmd.x; s.rallyY = cmd.y; }
        } else if (cmd.type === 'AssignControlGroup') {
          this.controlGroups[cmd.group] = cmd.unitIds.slice(0, 50);
        } else if (cmd.type === 'RecallControlGroup') {
          // UI handles selection recall based on returned ids.
        }
      }
    }

    handleBuildStructure(player, cmd) {
      const def = this.content.structures[cmd.structureType];
      if (!def) return;
      if (player.minerals < def.cost.minerals || player.gas < def.cost.gas) return;
      const faction = this.content.factions[player.faction];
      if (faction.requiresCreep && !this.hasCreep(player.id, cmd.x, cmd.y)) return;
      if (faction.requiresPower && cmd.structureType !== 'pylon' && !this.hasPower(player.id, cmd.x, cmd.y)) return;
      if (this.isBlocked(cmd.x, cmd.y, def.size * 0.55)) return;
      player.minerals -= def.cost.minerals;
      player.gas -= def.cost.gas;

      let builder = this.units.find((u) => u.id === cmd.builderId && u.owner === player.id && u.type.startsWith('worker'));
      const structure = this.addStructure(player.id, cmd.structureType, cmd.x, cmd.y, false, faction.builderMode === 'persistent' ? builder?.id || null : null);
      if (faction.builderMode === 'consumed' && builder) {
        builder.hp = 0;
      } else if (faction.builderMode === 'persistent' && builder) {
        builder.order = { type: 'buildAssist', structureId: structure.id };
      }
    }

    handleTrainUnit(player, structureId, unitType) {
      const s = this.structures.find((x) => x.id === structureId && x.owner === player.id && x.complete);
      const uDef = this.content.units[unitType];
      if (!s || !uDef) return;
      const sDef = this.content.structures[s.type];
      if (!sDef.train.includes(unitType)) return;
      if (player.minerals < uDef.cost.minerals || player.gas < uDef.cost.gas) return;
      if (player.supplyUsed + uDef.supply > player.supplyCap) return;
      if (sDef.larvaMax) {
        if (s.larva <= 0) return;
        s.larva--;
      }
      player.minerals -= uDef.cost.minerals;
      player.gas -= uDef.cost.gas;
      s.queue.push({ type: 'unit', unitType, progress: 0, total: Math.max(1, uDef.buildTime) });
    }

    productionSystem() {
      for (const s of this.structures) {
        const def = this.content.structures[s.type];
        if (!s.complete) {
          let buildRate = 1;
          const faction = this.content.factions[this.players[s.owner - 1].faction];
          if (faction.builderMode === 'persistent') {
            const b = s.builderId ? this.units.find((u) => u.id === s.builderId) : null;
            buildRate = b ? 1 : 0;
          }
          s.buildProgress += buildRate;
          s.hp = clamp(Math.floor((s.buildProgress / Math.max(1, s.buildTime)) * def.hp), 1, def.hp);
          if (s.buildProgress >= s.buildTime) {
            s.complete = true;
            s.hp = def.hp;
            this.alert(`Structure complete: ${def.name}`, s.x, s.y);
          }
        } else if (def.larvaMax) {
          s.larvaTicker++;
          if (s.larva < def.larvaMax && s.larvaTicker >= def.larvaRegen * this.tickRate) {
            s.larvaTicker = 0;
            s.larva++;
          }
        }

        if (s.complete && s.queue.length > 0) {
          const item = s.queue[0];
          item.progress++;
          if (item.progress >= item.total) {
            this.addUnit(s.owner, item.unitType, s.x + 70, s.y + 70);
            const produced = this.units[this.units.length - 1];
            produced.order = { type: 'move', x: s.rallyX, y: s.rallyY };
            s.queue.shift();
            this.alert(`Unit ready: ${this.content.units[item.unitType].name}`, s.x, s.y);
          }
        }
      }
      this.recomputeSupply();
    }

    economySystem() {
      for (const u of this.units) {
        if (!u.type.startsWith('worker')) continue;
        if (u.order.type === 'harvest') {
          const node = this.resources.find((r) => r.id === u.order.resourceId && r.amount > 0);
          if (!node) { u.order = { type: 'idle' }; continue; }
          const reach = node.radius + 20;
          if (dist2(u.x, u.y, node.x, node.y) > reach * reach) {
            u.order = { type: 'moveAndHarvest', x: node.x, y: node.y, resourceId: node.id };
          } else {
            if (u.cargoAmount < this.content.units[u.type].cargo) {
              if (this.tick % 7 === 0) {
                const mined = Math.min(2, node.amount);
                node.amount -= mined;
                u.cargoAmount += mined;
                u.cargoType = node.type;
              }
            } else {
              u.order = { type: 'returnCargo' };
            }
          }
        }
        if (u.order.type === 'moveAndHarvest') {
          if (dist2(u.x, u.y, u.order.x, u.order.y) < 120 * 120) {
            u.order = { type: 'harvest', resourceId: u.order.resourceId };
          }
        }
        if (u.order.type === 'returnCargo') {
          const home = this.findNearestTownHall(u.owner, u.x, u.y);
          if (!home) continue;
          if (dist2(u.x, u.y, home.x, home.y) > 110 * 110) {
            u.order = { type: 'returningMove', x: home.x, y: home.y };
          } else {
            const p = this.players[u.owner - 1];
            if (u.cargoType === 'minerals') p.minerals += u.cargoAmount;
            if (u.cargoType === 'gas') p.gas += u.cargoAmount;
            u.cargoAmount = 0;
            u.cargoType = null;
            const resource = this.findNearestResource(u.x, u.y, 'minerals');
            if (resource) u.order = { type: 'harvest', resourceId: resource.id };
            else u.order = { type: 'idle' };
          }
        }
        if (u.order.type === 'returningMove' && u.cargoAmount > 0) u.order = { type: 'returnCargo' };
      }
    }

    combatSystem() {
      for (const u of this.units) {
        if (u.cooldown > 0) u.cooldown--;
        const def = this.content.units[u.type];
        const enemy = this.findBestTarget(u, def.vision);
        if (u.order.type === 'attackMove' && enemy) u.order = { type: 'attackTarget', targetId: enemy.id };
        if (u.order.type === 'attackTarget') {
          const target = this.getById(u.order.targetId);
          if (!target || target.owner === u.owner || target.hp <= 0) { u.order = { type: 'idle' }; continue; }
          const tx = target.x;
          const ty = target.y;
          if (dist2(u.x, u.y, tx, ty) > def.range * def.range) {
            u.order = { type: 'chase', targetId: target.id };
          } else if (u.cooldown <= 0) {
            this.fireAt(u, target, def);
            u.cooldown = def.attackCooldown;
          }
        }
        if (u.order.type === 'chase') {
          const target = this.getById(u.order.targetId);
          if (!target || target.hp <= 0) { u.order = { type: 'idle' }; continue; }
          if (dist2(u.x, u.y, target.x, target.y) <= def.range * def.range) {
            u.order = { type: 'attackTarget', targetId: target.id };
          }
        }
      }

      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        const t = this.getById(p.targetId);
        if (!t || t.hp <= 0) { this.projectiles.splice(i, 1); continue; }
        const d2 = dist2(p.x, p.y, t.x, t.y);
        const step = p.speed / this.tickRate;
        if (d2 <= step * step) {
          t.hp -= p.damage;
          this.projectiles.splice(i, 1);
        } else {
          const d = Math.sqrt(d2) || 1;
          p.x += ((t.x - p.x) / d) * step;
          p.y += ((t.y - p.y) / d) * step;
        }
      }
    }

    fireAt(u, target, def) {
      if (def.projectileSpeed) {
        this.projectiles.push({ id: this.nextId++, owner: u.owner, x: u.x, y: u.y, targetId: target.id, speed: def.projectileSpeed, damage: def.damage });
      } else {
        target.hp -= def.damage;
      }
      if (target.owner === 1) this.alert('Under attack!', target.x, target.y, true);
    }

    pathSystem() {
      for (const u of this.units) {
        u.px = u.x;
        u.py = u.y;
        const def = this.content.units[u.type];
        let tx = u.x;
        let ty = u.y;
        if (u.order.type === 'move' || u.order.type === 'attackMove' || u.order.type === 'moveAndHarvest' || u.order.type === 'returningMove') {
          tx = u.order.x;
          ty = u.order.y;
        } else if (u.order.type === 'chase') {
          const t = this.getById(u.order.targetId);
          if (t) { tx = t.x; ty = t.y; }
        } else if (u.order.type === 'buildAssist') {
          const s = this.structures.find((x) => x.id === u.order.structureId && !x.complete);
          if (s) { tx = s.x; ty = s.y; }
        }

        const dx = tx - u.x;
        const dy = ty - u.y;
        const d2v = dx * dx + dy * dy;
        if (d2v > 8 * 8) {
          const d = Math.sqrt(d2v) || 1;
          const step = def.speed;
          let nx = u.x + (dx / d) * step;
          let ny = u.y + (dy / d) * step;
          const avoid = this.sampleAvoidance(u.id, nx, ny, def.radius);
          nx += avoid.x;
          ny += avoid.y;
          const blocked = this.isBlocked(nx, ny, def.radius);
          if (!blocked) {
            u.x = clamp(Math.round(nx), def.radius, this.world.width - def.radius);
            u.y = clamp(Math.round(ny), def.radius, this.world.height - def.radius);
          }
        }
      }
    }

    sampleAvoidance(unitId, nx, ny, radius) {
      let ax = 0;
      let ay = 0;
      for (const other of this.units) {
        if (other.id === unitId) continue;
        const rr = radius + this.content.units[other.type].radius + 6;
        const d2n = dist2(nx, ny, other.x, other.y);
        if (d2n < rr * rr) {
          const d = Math.sqrt(d2n) || 1;
          ax += ((nx - other.x) / d) * 10;
          ay += ((ny - other.y) / d) * 10;
        }
      }
      return { x: ax, y: ay };
    }

    visionSystem() {
      for (const p of this.players) p.fog.visible.fill(0);
      for (const p of this.players) {
        const fog = p.fog;
        for (const u of this.units) {
          if (u.owner !== p.id) continue;
          const r = this.content.units[u.type].vision;
          this.revealCircle(fog, u.x, u.y, r);
        }
        for (const s of this.structures) {
          if (s.owner !== p.id || !s.complete) continue;
          this.revealCircle(fog, s.x, s.y, 380);
        }
      }
    }

    revealCircle(fog, x, y, radius) {
      const cell = fog.cell;
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      const cr = Math.ceil(radius / cell);
      for (let yy = cy - cr; yy <= cy + cr; yy++) {
        if (yy < 0 || yy >= fog.h) continue;
        for (let xx = cx - cr; xx <= cx + cr; xx++) {
          if (xx < 0 || xx >= fog.w) continue;
          const wx = xx * cell + cell * 0.5;
          const wy = yy * cell + cell * 0.5;
          if (dist2(wx, wy, x, y) <= radius * radius) {
            const idx = yy * fog.w + xx;
            fog.visible[idx] = 1;
            fog.explored[idx] = 1;
          }
        }
      }
    }

    aiSystem() {
      if (this.tick % (this.tickRate * 2) !== 0) return;
      for (const p of this.players) {
        if (!p.ai) continue;
        const workers = this.units.filter((u) => u.owner === p.id && u.type.startsWith('worker'));
        for (const w of workers) {
          if (w.order.type === 'idle') {
            const node = this.findNearestResource(w.x, w.y, 'minerals');
            if (node) w.order = { type: 'harvest', resourceId: node.id };
          }
        }
        const town = this.structures.find((s) => s.owner === p.id && s.type === this.content.factions[p.faction].townHall);
        if (town && p.minerals >= 50 && workers.length < 12) this.handleTrainUnit(p, town.id, this.content.factions[p.faction].worker);
        const barracks = this.structures.filter((s) => s.owner === p.id && s.complete && this.content.structures[s.type].train.includes('melee'));
        for (const b of barracks) if (p.minerals >= 90 && p.supplyUsed + 2 <= p.supplyCap) this.handleTrainUnit(p, b.id, 'melee');
        if (p.minerals >= 120 && p.supplyCap - p.supplyUsed < 4) {
          const worker = workers[0];
          if (worker) {
            const sup = this.content.factions[p.faction].supplyProvider;
            this.handleBuildStructure(p, { structureType: sup, x: town.x + 220 - this.rng.nextFloat() * 440, y: town.y + 220 - this.rng.nextFloat() * 440, builderId: worker.id });
          }
        }

        const army = this.units.filter((u) => u.owner === p.id && !u.type.startsWith('worker'));
        if (army.length >= 8) {
          const enemyTown = this.structures.find((s) => s.owner !== p.id);
          if (enemyTown) for (const a of army) a.order = { type: 'attackMove', x: enemyTown.x, y: enemyTown.y };
        }
      }
    }

    cleanupSystem() {
      for (let i = this.units.length - 1; i >= 0; i--) {
        if (this.units[i].hp <= 0) this.units.splice(i, 1);
      }
      for (let i = this.structures.length - 1; i >= 0; i--) {
        if (this.structures[i].hp <= 0) this.structures.splice(i, 1);
      }
      this.recomputeSupply();
      this.rebuildPathGrid();
    }

    recomputeSupply() {
      for (const p of this.players) { p.supplyCap = 0; p.supplyUsed = 0; }
      for (const s of this.structures) {
        if (!s.complete) continue;
        this.players[s.owner - 1].supplyCap += this.content.structures[s.type].providesSupply || 0;
      }
      for (const u of this.units) {
        this.players[u.owner - 1].supplyUsed += this.content.units[u.type].supply || 0;
      }
    }

    findBestTarget(u, radius) {
      let best = null;
      let bestD = radius * radius;
      for (const e of this.units) {
        if (e.owner === u.owner) continue;
        const d = dist2(u.x, u.y, e.x, e.y);
        if (d < bestD) { bestD = d; best = e; }
      }
      for (const e of this.structures) {
        if (e.owner === u.owner) continue;
        const d = dist2(u.x, u.y, e.x, e.y);
        if (d < bestD) { bestD = d; best = e; }
      }
      return best;
    }

    findNearestTownHall(owner, x, y) {
      let best = null;
      let bd = Infinity;
      const tt = this.content.factions[this.players[owner - 1].faction].townHall;
      for (const s of this.structures) {
        if (s.owner !== owner || s.type !== tt || !s.complete) continue;
        const d = dist2(x, y, s.x, s.y);
        if (d < bd) { bd = d; best = s; }
      }
      return best;
    }

    findNearestResource(x, y, type) {
      let best = null;
      let bd = Infinity;
      for (const r of this.resources) {
        if (r.type !== type || r.amount <= 0) continue;
        const d = dist2(x, y, r.x, r.y);
        if (d < bd) { bd = d; best = r; }
      }
      return best;
    }

    hasCreep(owner, x, y) {
      for (const s of this.structures) {
        if (s.owner !== owner || !s.complete) continue;
        const r = this.content.structures[s.type].creepRadius || 0;
        if (r > 0 && dist2(s.x, s.y, x, y) <= r * r) return true;
      }
      return false;
    }

    hasPower(owner, x, y) {
      for (const s of this.structures) {
        if (s.owner !== owner || !s.complete) continue;
        const r = this.content.structures[s.type].powerRadius || 0;
        if (r > 0 && dist2(s.x, s.y, x, y) <= r * r) return true;
      }
      return false;
    }

    isBlocked(x, y, r) {
      for (const s of this.structures) {
        const sr = (this.content.structures[s.type].size || 100) * 0.55;
        if (dist2(x, y, s.x, s.y) < (r + sr) * (r + sr)) return true;
      }
      return false;
    }

    rebuildPathGrid() {
      const gw = Math.ceil(this.world.width / this.world.cell);
      const gh = Math.ceil(this.world.height / this.world.cell);
      this.pathGrid.fill(0);
      for (const s of this.structures) {
        const sz = (this.content.structures[s.type].size || 100) * 0.6;
        const minx = clamp(Math.floor((s.x - sz) / this.world.cell), 0, gw - 1);
        const maxx = clamp(Math.floor((s.x + sz) / this.world.cell), 0, gw - 1);
        const miny = clamp(Math.floor((s.y - sz) / this.world.cell), 0, gh - 1);
        const maxy = clamp(Math.floor((s.y + sz) / this.world.cell), 0, gh - 1);
        for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) this.pathGrid[y * gw + x] = 1;
      }
    }

    alert(text, x, y, urgent = false) {
      if (this.alerts.length > 7) this.alerts.shift();
      this.alerts.push({ text, tick: this.tick, urgent });
      this.lastAlertPos = { x, y };
    }

    getVisibleState(playerId) {
      const p = this.players[playerId - 1];
      const fog = p.fog;
      const visibleCheck = (x, y) => {
        const gx = Math.floor(x / fog.cell);
        const gy = Math.floor(y / fog.cell);
        if (gx < 0 || gy < 0 || gx >= fog.w || gy >= fog.h) return false;
        return fog.visible[gy * fog.w + gx] === 1;
      };
      return {
        tick: this.tick,
        players: this.players,
        units: this.units.filter((u) => u.owner === playerId || visibleCheck(u.x, u.y)),
        structures: this.structures.filter((s) => s.owner === playerId || visibleCheck(s.x, s.y)),
        resources: this.resources,
        projectiles: this.projectiles,
        fog,
        world: this.world,
        alerts: this.alerts,
        lastAlertPos: this.lastAlertPos
      };
    }
  }

  window.RTSGame = RTSGame;
})();
