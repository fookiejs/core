import { Done } from "@fookiejs/core";
import { bead, createFookie, randomBead } from "./model.ts";
import { churnBatch, pad, seedCount, stepMotion, tickBatch, tickMs, worldSize } from "./world.ts";

type Fookie = ReturnType<typeof createFookie>;

type Moving = {
  id: string;
  x: number;
  y: number;
  hue: number;
  size: number;
  light: number;
  vx: number;
  vy: number;
};

function drift(): number {
  return (Math.random() - 0.5) * 2.6;
}

function keepMoving(vx: number, vy: number, min: number): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy);
  if (speed >= min) {
    return { vx, vy };
  }
  if (speed === 0) {
    return { vx: drift(), vy: drift() };
  }
  return { vx: (vx / speed) * min, vy: (vy / speed) * min };
}

function capSpeed(vx: number, vy: number, max: number): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy);
  if (speed <= max) {
    return { vx, vy };
  }
  return { vx: (vx / speed) * max, vy: (vy / speed) * max };
}

function toMoving(
  id: string,
  seed: { x: number; y: number; hue: number; size: number; light: number },
): Moving {
  return {
    id,
    x: seed.x,
    y: seed.y,
    hue: seed.hue,
    size: seed.size,
    light: seed.light,
    vx: drift(),
    vy: drift(),
  };
}

function yieldLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function loadMoving(fookie: Fookie): Promise<Moving[]> {
  const found: Moving[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const batch = await fookie.list(bead, {}, { limit: [limit], offset: [offset], order: [] });
    if (batch.signal !== Done) {
      break;
    }
    for (const row of batch.results) {
      const id = row.id;
      const x = row.x;
      const y = row.y;
      const hue = row.hue;
      const size = row.size;
      const light = row.light;
      if (typeof id !== "string") {
        continue;
      }
      if (typeof x !== "number") {
        continue;
      }
      if (typeof y !== "number") {
        continue;
      }
      if (typeof hue !== "number") {
        continue;
      }
      if (typeof size !== "number") {
        continue;
      }
      if (typeof light !== "number") {
        continue;
      }
      found.push(toMoving(id, { x, y, hue, size, light }));
    }
    if (batch.results.length < limit) {
      break;
    }
    offset = offset + batch.results.length;
  }
  return found;
}

export async function startMotion(fookie: Fookie): Promise<{ stop(): void }> {
  const moving: Moving[] = [];
  const byId = new Map<string, Moving>();
  const lo = pad;
  const hi = worldSize - pad;

  function putMoving(row: Moving): void {
    const prev = byId.get(row.id);
    if (prev === undefined) {
      moving.push(row);
      byId.set(row.id, row);
      return;
    }
    prev.x = row.x;
    prev.y = row.y;
    prev.hue = row.hue;
    prev.size = row.size;
    prev.light = row.light;
    prev.vx = row.vx;
    prev.vy = row.vy;
  }

  function dropMoving(id: string): void {
    byId.delete(id);
    const kept: Moving[] = [];
    for (const row of moving) {
      if (row.id !== id) {
        kept.push(row);
      }
    }
    moving.length = 0;
    for (const row of kept) {
      moving.push(row);
    }
  }

  const loaded = await loadMoving(fookie);
  for (const row of loaded) {
    putMoving(row);
  }
  while (moving.length < seedCount) {
    const seed = randomBead();
    const made = await fookie.create(bead, seed);
    if (made.signal !== Done) {
      throw new Error("seed failed");
    }
    putMoving(toMoving(made.id, seed));
  }

  async function refreshMoving(): Promise<void> {
    const found = await loadMoving(fookie);
    const prev = new Map<string, Moving>();
    for (const row of moving) {
      prev.set(row.id, row);
    }
    moving.length = 0;
    byId.clear();
    for (const row of found) {
      const old = prev.get(row.id);
      if (old === undefined) {
        putMoving(row);
        continue;
      }
      putMoving(old);
    }
  }

  async function swap(count: number): Promise<void> {
    const drop = Math.min(count, moving.length);
    const victims: Moving[] = [];
    const used = new Set<string>();
    let guard = 0;
    while (victims.length < drop && used.size < moving.length && guard < moving.length * 12) {
      guard = guard + 1;
      const row = moving[Math.floor(Math.random() * moving.length)];
      if (row === undefined) {
        continue;
      }
      if (used.has(row.id)) {
        continue;
      }
      used.add(row.id);
      victims.push(row);
    }
    for (const row of victims) {
      await fookie.delete(bead, { id: row.id, filter: {} });
      await yieldLoop();
    }
    await refreshMoving();
  }

  fookie.onOperationSettled((event) => {
    if (event.model !== bead.name) {
      return;
    }
    if (event.operation === "delete") {
      dropMoving(event.id);
      return;
    }
    if (event.operation !== "create") {
      return;
    }
    if (byId.has(event.id)) {
      return;
    }
    void (async () => {
      const found = await fookie.list(
        bead,
        { id: { eq: event.id } },
        { limit: [1], offset: [0], order: [] },
      );
      if (found.signal !== Done) {
        return;
      }
      const row = found.results[0];
      if (row === undefined) {
        return;
      }
      const id = row.id;
      const x = row.x;
      const y = row.y;
      const hue = row.hue;
      const size = row.size;
      const light = row.light;
      if (typeof id !== "string") {
        return;
      }
      if (typeof x !== "number") {
        return;
      }
      if (typeof y !== "number") {
        return;
      }
      if (typeof hue !== "number") {
        return;
      }
      if (typeof size !== "number") {
        return;
      }
      if (typeof light !== "number") {
        return;
      }
      putMoving(toMoving(id, { x, y, hue, size, light }));
    })();
  });

  const busy = { on: false };
  const walk = { at: 0 };
  const blink = setInterval(() => {
    if (busy.on) {
      return;
    }
    if (moving.length < 1) {
      return;
    }
    busy.on = true;
    void (async () => {
      try {
        const picks = Math.min(tickBatch, moving.length);
        const doomed: string[] = [];
        let n = 0;
        while (n < picks) {
          const row = moving[walk.at % moving.length];
          walk.at = walk.at + 1;
          n = n + 1;
          if (row === undefined) {
            continue;
          }
          if (Math.random() < 0.06) {
            row.vx = row.vx + (Math.random() - 0.5) * 0.7;
            row.vy = row.vy + (Math.random() - 0.5) * 0.7;
          }
          const boom = Math.random() < 0.00012;
          if (boom) {
            doomed.push(row.id);
            await fookie.delete(bead, { id: row.id, filter: {} });
            await yieldLoop();
            continue;
          }
          const capped = capSpeed(row.vx, row.vy, 4.4);
          row.vx = capped.vx;
          row.vy = capped.vy;
          const paced = keepMoving(row.vx, row.vy, 1.8);
          row.vx = paced.vx;
          row.vy = paced.vy;
          const stepped = stepMotion(row.x, row.y, row.vx, row.vy, lo, hi, drift);
          const dx = stepped.x - row.x;
          const dy = stepped.y - row.y;
          row.x = stepped.x;
          row.vx = stepped.vx;
          row.y = stepped.y;
          row.vy = stepped.vy;
          await fookie.update(
            bead,
            { id: { eq: row.id } },
            {
              hue: row.hue,
              x: { add: dx },
              y: { add: dy },
              size: row.size,
              light: row.light,
            },
          );
          await yieldLoop();
        }
        if (doomed.length > 0) {
          for (const id of doomed) {
            dropMoving(id);
          }
        }
      } finally {
        busy.on = false;
      }
    })();
  }, tickMs);

  const churning = { on: false };
  const churn = setInterval(() => {
    if (churning.on) {
      return;
    }
    if (busy.on) {
      return;
    }
    if (moving.length < 1) {
      return;
    }
    churning.on = true;
    void swap(churnBatch).finally(() => {
      churning.on = false;
    });
  }, 5000);

  return {
    stop() {
      clearInterval(blink);
      clearInterval(churn);
    },
  };
}
