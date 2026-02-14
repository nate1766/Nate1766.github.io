export type Point = { x: number; y: number };

export type Grid = {
  w: number;
  h: number;
  isBlocked(p: Point): boolean;
  cost(p: Point): number;
};

function key(p: Point): string {
  return `${p.x},${p.y}`;
}

function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function aStar(grid: Grid, start: Point, goal: Point): Point[] | null {
  const open = new Map<string, Point>([[key(start), start]]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[key(start), 0]]);
  const fScore = new Map<string, number>([[key(start), manhattan(start, goal)]]);

  const neighbors = (p: Point): Point[] =>
    [
      { x: p.x + 1, y: p.y },
      { x: p.x - 1, y: p.y },
      { x: p.x, y: p.y + 1 },
      { x: p.x, y: p.y - 1 }
    ].filter((n) => n.x >= 0 && n.y >= 0 && n.x < grid.w && n.y < grid.h && !grid.isBlocked(n));

  while (open.size > 0) {
    let current: Point | null = null;
    let best = Number.POSITIVE_INFINITY;

    for (const p of open.values()) {
      const score = fScore.get(key(p)) ?? Number.POSITIVE_INFINITY;
      if (score < best) {
        best = score;
        current = p;
      }
    }

    if (!current) break;

    if (current.x === goal.x && current.y === goal.y) {
      const path: Point[] = [current];
      let cursor = key(current);
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor)!;
        const [x, y] = cursor.split(",").map(Number);
        path.push({ x, y });
      }
      path.reverse();
      return path;
    }

    const currentKey = key(current);
    open.delete(currentKey);
    const currentG = gScore.get(currentKey) ?? Number.POSITIVE_INFINITY;

    for (const nb of neighbors(current)) {
      const nbKey = key(nb);
      const tentative = currentG + grid.cost(nb);
      if (tentative < (gScore.get(nbKey) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(nbKey, currentKey);
        gScore.set(nbKey, tentative);
        fScore.set(nbKey, tentative + manhattan(nb, goal));
        open.set(nbKey, nb);
      }
    }
  }

  return null;
}
