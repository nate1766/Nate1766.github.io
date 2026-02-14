import { validateCommand } from './game/commands';
import { GameLoop, enqueueCommand } from './game/engine';
import type { Command, Entity, StructureEntity, UnitEntity } from './game/types';
import { Renderer } from './render/renderer';
import { Hud } from './ui/hud';

const app = document.getElementById('app');
if (!app) throw new Error('Missing app node');

const canvas = document.createElement('canvas');
canvas.style.width = '100%';
canvas.style.height = '100%';
app.append(canvas);

const renderer = new Renderer(canvas);
const loop = new GameLoop(1337);
const hud = new Hud(app);

let camera = { x: 0, y: 0, zoom: 0.25 };
let selected: number[] = [];
let attackMode = false;
let debug = false;
let dragging = false;
let dragStart = { x: 0, y: 0 };
const keys = new Set<string>();

const worldFromClient = (cx: number, cy: number): { x: number; y: number } => ({
  x: camera.x + cx / camera.zoom,
  y: camera.y + cy / camera.zoom,
});

const selectInBox = (x0: number, y0: number, x1: number, y1: number): void => {
  const minx = Math.min(x0, x1);
  const miny = Math.min(y0, y1);
  const maxx = Math.max(x0, x1);
  const maxy = Math.max(y0, y1);
  selected = loop.state.entities
    .filter(
      (e): e is UnitEntity => e.kind === 'unit' && e.owner === 0 && e.x >= minx && e.x <= maxx && e.y >= miny && e.y <= maxy && e.alive,
    )
    .map((e) => e.id);
};

const pickEntity = (x: number, y: number): Entity | undefined => {
  const vis = loop.state.visibility[0];
  return [...loop.state.entities].reverse().find((e) => {
    if (!e.alive) return false;
    if (e.owner > 0) {
      const idx = Math.floor(e.y / vis.cell) * vis.width + Math.floor(e.x / vis.cell);
      if (!vis.visible[idx]) return false;
    }
    const dx = e.x - x;
    const dy = e.y - y;
    return dx * dx + dy * dy <= (e.radius * e.radius) / 4;
  });
};

const issue = (command: Omit<Command, 'tick'>): void => {
  if (!validateCommand(loop.state, { ...command, tick: loop.state.tick + 1 })) return;
  enqueueCommand(loop.state, command);
};

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  dragging = true;
  dragStart = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener('mouseup', (e) => {
  const world = worldFromClient(e.clientX, e.clientY);
  if (dragging && Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 8) {
    const s = worldFromClient(dragStart.x, dragStart.y);
    selectInBox(s.x, s.y, world.x, world.y);
  } else {
    const hit = pickEntity(world.x, world.y);
    if (hit && hit.owner === 0) {
      if (e.shiftKey) selected = [...new Set([...selected, hit.id])];
      else selected = [hit.id];
    } else if (!e.shiftKey) selected = [];
  }
  dragging = false;
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const world = worldFromClient(e.clientX, e.clientY);
  const hit = pickEntity(world.x, world.y);
  const units = selected
    .map((id) => loop.state.entities.find((v): v is UnitEntity => v.id === id && v.kind === 'unit' && v.owner === 0 && v.alive))
    .filter((u): u is UnitEntity => !!u);

  if (hit?.kind === 'resource') {
    issue({ playerId: 0, type: 'Harvest', unitIds: units.filter((u) => u.type === 'worker').map((u) => u.id), targetId: hit.id });
    return;
  }
  if (hit && hit.owner !== 0) {
    issue({ playerId: 0, type: 'AttackTarget', unitIds: units.map((u) => u.id), targetId: hit.id });
    return;
  }
  issue({ playerId: 0, type: attackMode ? 'AttackMove' : 'Move', unitIds: units.map((u) => u.id), x: world.x, y: world.y });
  attackMode = false;
});

window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'a') attackMode = true;
  if (e.key === '`') debug = !debug;
  if (e.key.toLowerCase() === 'b') {
    // build shortcuts are exposed in command card
  }
  const n = Number(e.key);
  if (n >= 1 && n <= 9) {
    if (e.ctrlKey) {
      issue({ playerId: 0, type: 'AssignControlGroup', unitIds: selected, group: n });
    } else {
      const ids = loop.state.players[0].controlGroups[n] ?? [];
      selected = ids.filter((id) => loop.state.entities.some((e) => e.id === id && e.alive));
    }
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  camera.zoom = Math.min(0.8, Math.max(0.16, camera.zoom + (e.deltaY > 0 ? -0.02 : 0.02)));
});

hud.resetBtn.onclick = () => loop.reset((Math.random() * 1e9) | 0);
hud.minimap.addEventListener('click', (e) => {
  const rect = hud.minimap.getBoundingClientRect();
  const rx = (e.clientX - rect.left) / rect.width;
  const ry = (e.clientY - rect.top) / rect.height;
  camera.x = rx * loop.state.map.width - canvas.width / camera.zoom / 2;
  camera.y = ry * loop.state.map.height - canvas.height / camera.zoom / 2;
});

let last = performance.now();
const frame = (t: number): void => {
  const dt = Math.min(60, t - last);
  last = t;

  const pan = 38 / camera.zoom;
  if (keys.has('w')) camera.y -= pan;
  if (keys.has('s')) camera.y += pan;
  if (keys.has('a') && !attackMode) camera.x -= pan;
  if (keys.has('d')) camera.x += pan;

  const edge = 8;
  // edge pan via mouse position from selection drag start approximation
  if (dragging) {
    if (dragStart.x < edge) camera.x -= pan;
    if (dragStart.x > canvas.width - edge) camera.x += pan;
    if (dragStart.y < edge) camera.y -= pan;
    if (dragStart.y > canvas.height - edge) camera.y += pan;
  }

  camera.x = Math.max(0, Math.min(loop.state.map.width - canvas.width / camera.zoom, camera.x));
  camera.y = Math.max(0, Math.min(loop.state.map.height - canvas.height / camera.zoom, camera.y));

  loop.update(dt);

  const selectedUnits = selected
    .map((id) => loop.state.entities.find((e): e is UnitEntity => e.id === id && e.kind === 'unit' && e.alive))
    .filter((e): e is UnitEntity => !!e);
  const selectedBuilding = loop.state.entities.find(
    (e): e is StructureEntity => e.id === selected[0] && e.kind === 'structure' && e.owner === 0 && e.alive,
  ) ?? null;

  renderer.render(loop.state, camera, selected, debug);
  hud.render(loop.state, selectedUnits, selectedBuilding, issue);
  requestAnimationFrame(frame);
};

const resize = (): void => renderer.resize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
