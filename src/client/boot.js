import { createGameLoop } from "./game-loop.js";

function createInitialUnits() {
  return [
    { id: 1, x: 180, y: 210, vx: 0, vy: 0, speed: 100, targetX: 180, targetY: 210, selected: false, radius: 12, color: "#69d2ff" },
    { id: 2, x: 240, y: 260, vx: 0, vy: 0, speed: 95, targetX: 240, targetY: 260, selected: false, radius: 12, color: "#69d2ff" },
    { id: 3, x: 300, y: 220, vx: 0, vy: 0, speed: 92, targetX: 300, targetY: 220, selected: false, radius: 12, color: "#69d2ff" },
    { id: 4, x: 760, y: 320, vx: 0, vy: 0, speed: 0, targetX: 760, targetY: 320, selected: false, radius: 12, color: "#ff7b7b", enemy: true }
  ];
}

function updateHud(state) {
  const selected = state.units.filter((u) => u.selected).length;
  document.getElementById("hud-selection").textContent = `Selected: ${selected}`;
  document.getElementById("hud-status").textContent = `Status: Running @ ${state.tps} TPS`;
}

function worldStep(state, dtSec) {
  for (const unit of state.units) {
    if (unit.enemy) continue;
    const dx = unit.targetX - unit.x;
    const dy = unit.targetY - unit.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) {
      unit.vx = 0;
      unit.vy = 0;
      continue;
    }
    unit.vx = (dx / dist) * unit.speed;
    unit.vy = (dy / dist) * unit.speed;
    unit.x += unit.vx * dtSec;
    unit.y += unit.vy * dtSec;
  }
}

function render(state) {
  const { ctx, canvas } = state;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#2a3c52";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  for (const unit of state.units) {
    ctx.fillStyle = unit.color;
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, unit.radius, 0, Math.PI * 2);
    ctx.fill();

    if (unit.selected) {
      ctx.strokeStyle = "#f6e47a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(unit.x, unit.y, unit.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (state.drag.active) {
    const x = Math.min(state.drag.startX, state.drag.nowX);
    const y = Math.min(state.drag.startY, state.drag.nowY);
    const w = Math.abs(state.drag.nowX - state.drag.startX);
    const h = Math.abs(state.drag.nowY - state.drag.startY);

    ctx.fillStyle = "rgba(126, 196, 255, 0.18)";
    ctx.strokeStyle = "rgba(126, 196, 255, 0.7)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }
}

function toCanvasPos(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * sx,
    y: (event.clientY - rect.top) * sy
  };
}

function setupInput(state) {
  const { canvas } = state;

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  canvas.addEventListener("mousedown", (event) => {
    const pos = toCanvasPos(canvas, event);

    if (event.button === 0) {
      state.drag.active = true;
      state.drag.startX = pos.x;
      state.drag.startY = pos.y;
      state.drag.nowX = pos.x;
      state.drag.nowY = pos.y;
      return;
    }

    if (event.button === 2) {
      const selectedUnits = state.units.filter((u) => u.selected && !u.enemy);
      selectedUnits.forEach((u, i) => {
        u.targetX = pos.x + i * 16;
        u.targetY = pos.y + i * 12;
      });
    }
  });

  canvas.addEventListener("mousemove", (event) => {
    if (!state.drag.active) return;
    const pos = toCanvasPos(canvas, event);
    state.drag.nowX = pos.x;
    state.drag.nowY = pos.y;
  });

  canvas.addEventListener("mouseup", (event) => {
    if (event.button !== 0 || !state.drag.active) return;
    const pos = toCanvasPos(canvas, event);
    state.drag.nowX = pos.x;
    state.drag.nowY = pos.y;

    const xMin = Math.min(state.drag.startX, state.drag.nowX);
    const xMax = Math.max(state.drag.startX, state.drag.nowX);
    const yMin = Math.min(state.drag.startY, state.drag.nowY);
    const yMax = Math.max(state.drag.startY, state.drag.nowY);
    const clickSelect = Math.abs(xMax - xMin) < 4 && Math.abs(yMax - yMin) < 4;

    state.units.forEach((unit) => {
      if (unit.enemy) {
        unit.selected = false;
        return;
      }
      if (clickSelect) {
        unit.selected = Math.hypot(unit.x - pos.x, unit.y - pos.y) <= unit.radius + 4;
      } else {
        unit.selected = unit.x >= xMin && unit.x <= xMax && unit.y >= yMin && unit.y <= yMax;
      }
    });

    state.drag.active = false;
    updateHud(state);
  });
}

export function boot() {
  const canvas = document.getElementById("rts-canvas");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Missing #rts-canvas element");
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to initialize 2D canvas context");
  }

  const state = {
    canvas,
    ctx,
    tps: 20,
    units: createInitialUnits(),
    drag: { active: false, startX: 0, startY: 0, nowX: 0, nowY: 0 }
  };

  setupInput(state);
  updateHud(state);

  const loop = createGameLoop({
    tickMs: 1000 / state.tps,
    update: (dtMs) => worldStep(state, dtMs / 1000),
    render: () => render(state)
  });

  loop.start();
}
