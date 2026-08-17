export const worldSize = 900;
export const cellSize = 300;
export const cols = 3;
export const rows = 3;
export const pad = 10;
export const seedCount = 96;
export const churnBatch = 2;
export const tickMs = 50;
export const tickBatch = 12;

export type Cell = {
  col: number;
  row: number;
};

export function cellOf(x: number, y: number): Cell {
  const col = Math.min(cols - 1, Math.max(0, Math.floor(x / cellSize)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor(y / cellSize)));
  return { col, row };
}

export function cellRoom(x: number, y: number): string {
  const at = cellOf(x, y);
  return `cell:${at.col},${at.row}`;
}

export function bounce(
  pos: number,
  vel: number,
  lo: number,
  hi: number,
): { pos: number; vel: number } {
  let next = pos + vel;
  let speed = vel;
  if (next < lo) {
    next = lo;
    speed = Math.abs(speed);
  }
  if (next > hi) {
    next = hi;
    speed = -Math.abs(speed);
  }
  return { pos: next, vel: speed };
}

export function stepMotion(
  x: number,
  y: number,
  vx: number,
  vy: number,
  lo: number,
  hi: number,
  noise: () => number,
): { x: number; y: number; vx: number; vy: number } {
  const steppedX = bounce(x, vx, lo, hi);
  const steppedY = bounce(y, vy, lo, hi);
  let nextVx = steppedX.vel;
  let nextVy = steppedY.vel;
  const hitX = steppedX.vel !== vx;
  const hitY = steppedY.vel !== vy;
  if (hitX && hitY) {
    nextVx = (steppedX.pos <= lo ? 1 : -1) * Math.abs(noise());
    nextVy = (steppedY.pos <= lo ? 1 : -1) * Math.abs(noise());
  } else if (hitX) {
    nextVy = nextVy + noise() * 0.45;
  } else if (hitY) {
    nextVx = nextVx + noise() * 0.45;
  }
  return { x: steppedX.pos, y: steppedY.pos, vx: nextVx, vy: nextVy };
}
