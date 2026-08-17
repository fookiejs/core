export const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>space</title>
<style>
html,body{margin:0;height:100%;background:#07080c;color:#d7dce8;font:14px/1.4 ui-sans-serif,system-ui;overflow:hidden}
canvas{display:block;width:100%;height:100%}
#hud{position:fixed;left:16px;bottom:16px;opacity:.85;background:#07080ccc;padding:8px 12px;border-radius:8px}
</style>
</head>
<body>
<canvas id="view"></canvas>
<div id="hud">WASD move · click in your room to poke or drop a bead</div>
<script>
const WORLD = 900;
const CELL = 300;
const COLS = 3;
const ROWS = 3;
const PAGE = 80;
const canvas = document.getElementById("view");
const hud = document.getElementById("hud");
const ctx = canvas.getContext("2d");
const keys = {};
const beads = new Map();
const player = {
  x: 8 + Math.random() * (WORLD - 16),
  y: 8 + Math.random() * (WORLD - 16),
};
let stream = null;
const clientId = crypto.randomUUID();
let watchGen = 0;
let cellCol = -1;
let cellRow = -1;
let backend = "";

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

window.addEventListener("keydown", (event) => { keys[event.code] = true; });
window.addEventListener("keyup", (event) => { keys[event.code] = false; });

function clamp(value, lo, hi) {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

function cellOf(x, y) {
  return {
    col: clamp(Math.floor(x / CELL), 0, COLS - 1),
    row: clamp(Math.floor(y / CELL), 0, ROWS - 1),
  };
}

function toScreen(x, y) {
  return { x: (x / WORLD) * canvas.width, y: (y / WORLD) * canvas.height };
}

function toWorld(sx, sy) {
  return { x: (sx / canvas.width) * WORLD, y: (sy / canvas.height) * WORLD };
}

async function gql(query, variables) {
  const response = await fetch("/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

function hueColor(hue, light) {
  return "hsl(" + hue + " 80% " + (18 + light * 52) + "%)";
}

function remember(row) {
  const prev = beads.get(row.id);
  if (prev && typeof prev.px === "number" && typeof prev.py === "number") {
    beads.set(row.id, Object.assign({}, row, { px: prev.px, py: prev.py }));
    return;
  }
  beads.set(row.id, Object.assign({}, row, { px: row.x, py: row.y }));
}

function chase(item) {
  if (typeof item.px !== "number") item.px = item.x;
  if (typeof item.py !== "number") item.py = item.y;
  const dx = item.x - item.px;
  const dy = item.y - item.py;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.2) {
    item.px = item.x;
    item.py = item.y;
    return;
  }
  const step = Math.min(dist, Math.min(16, Math.max(3.2, dist * 0.14)));
  item.px += (dx / dist) * step;
  item.py += (dy / dist) * step;
}

function openStream() {
  if (stream !== null && stream.readyState !== EventSource.CLOSED) return;
  if (stream !== null) {
    stream.close();
    stream = null;
  }
  stream = new EventSource("/stream?client=" + encodeURIComponent(clientId));
  stream.addEventListener("next", async (event) => {
    const parsed = JSON.parse(event.data);
    const frames = parsed.data.events;
    if (Array.isArray(frames) === false) return;
    const ids = [];
    const seen = new Set();
    for (const envelope of frames) {
      if (typeof envelope.id !== "string") continue;
      if (envelope.operation !== "update") continue;
      if (seen.has(envelope.id)) continue;
      seen.add(envelope.id);
      ids.push(envelope.id);
    }
    if (ids.length < 1) return;
    const data = await gql(
      "query($filter: BeadFilter, $limit: Int) { beads(filter: $filter, limit: $limit) { id x y shape size hue light } }",
      { filter: { id: { in: ids } }, limit: ids.length },
    );
    for (const row of data.beads) remember(row);
  });
}

async function loadAll() {
  let cursor = 0;
  while (true) {
    const data = await gql(
      "query($filter: BeadFilter, $limit: Int, $offset: Int) { beads(filter: $filter, limit: $limit, offset: $offset) { id x y shape size hue light } }",
      { filter: {}, limit: PAGE, offset: cursor },
    );
    if (data.beads.length < 1) break;
    for (const row of data.beads) remember(row);
    cursor = cursor + data.beads.length;
    if (data.beads.length < PAGE) break;
  }
}

async function snapshotRoom(col, row) {
  const gen = ++watchGen;
  const filter = {
    x: { gte: col * CELL, lt: (col + 1) * CELL },
    y: { gte: row * CELL, lt: (row + 1) * CELL },
  };
  const nextIds = new Set();
  let cursor = 0;
  while (true) {
    if (gen !== watchGen) return;
    const data = await gql(
      "query($filter: BeadFilter, $limit: Int, $offset: Int) { beads(filter: $filter, limit: $limit, offset: $offset) { id x y shape size hue light } }",
      { filter, limit: PAGE, offset: cursor },
    );
    if (gen !== watchGen) return;
    if (data.beads.length < 1) break;
    for (const row of data.beads) {
      remember(row);
      nextIds.add(row.id);
    }
    cursor = cursor + data.beads.length;
    if (data.beads.length < PAGE) break;
  }
  if (gen !== watchGen) return;
  const stale = [];
  for (const [id, item] of beads) {
    const at = cellOf(item.x, item.y);
    if (at.col === col && at.row === row && nextIds.has(id) === false) stale.push(id);
  }
  if (stale.length < 1) return;
  const data = await gql(
    "query($filter: BeadFilter, $limit: Int) { beads(filter: $filter, limit: $limit) { id x y shape size hue light } }",
    { filter: { id: { in: stale } }, limit: stale.length },
  );
  if (gen !== watchGen) return;
  const found = new Set();
  for (const row of data.beads) {
    remember(row);
    found.add(row.id);
  }
  for (const id of stale) {
    if (found.has(id) === false) beads.delete(id);
  }
}

function enterIfMoved() {
  const at = cellOf(player.x, player.y);
  if (at.col === cellCol && at.row === cellRow) return;
  cellCol = at.col;
  cellRow = at.row;
  openStream();
  void snapshotRoom(cellCol, cellRow);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  if (cellCol < 0) return;
  openStream();
  void (async () => {
    await loadAll();
    await snapshotRoom(cellCol, cellRow);
  })();
});

canvas.addEventListener("click", async (event) => {
  const world = toWorld(event.clientX, event.clientY);
  const at = cellOf(world.x, world.y);
  if (at.col !== cellCol || at.row !== cellRow) return;
  let nearest = null;
  let best = 28;
  for (const item of beads.values()) {
    const here = cellOf(item.x, item.y);
    if (here.col !== cellCol || here.row !== cellRow) continue;
    const hx = typeof item.px === "number" ? item.px : item.x;
    const hy = typeof item.py === "number" ? item.py : item.y;
    const dx = hx - world.x;
    const dy = hy - world.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < best) {
      best = dist;
      nearest = item;
    }
  }
  if (nearest) {
    await gql(
      "mutation($filter: BeadFilter, $body: BeadUpdateInput!) { updateBead(filter: $filter, body: $body) { signal ids } }",
      { filter: { id: { eq: nearest.id } }, body: { hue: (nearest.hue + 80) % 360 } },
    );
    const data = await gql("query($id: UUID!) { bead(id: $id) { id x y shape size hue light } }", {
      id: nearest.id,
    });
    if (data.bead) remember(data.bead);
    return;
  }
  const made = await gql(
    "mutation($body: BeadCreateInput!) { createBead(body: $body) { signal id } }",
    {
      body: {
        x: world.x,
        y: world.y,
        shape: "round",
        size: 12,
        hue: 48,
        light: 0.8,
      },
    },
  );
  if (made.createBead.signal !== "DONE" && made.createBead.signal !== "done") return;
  const data = await gql("query($id: UUID!) { bead(id: $id) { id x y shape size hue light } }", {
    id: made.createBead.id,
  });
  if (data.bead) remember(data.bead);
});

function draw() {
  const speed = 2.4;
  if (keys.KeyW) player.y -= speed;
  if (keys.KeyS) player.y += speed;
  if (keys.KeyA) player.x -= speed;
  if (keys.KeyD) player.x += speed;
  player.x = clamp(player.x, 8, WORLD - 8);
  player.y = clamp(player.y, 8, WORLD - 8);
  enterIfMoved();

  ctx.fillStyle = "#07080c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cellW = canvas.width / COLS;
  const cellH = canvas.height / ROWS;
  if (cellCol >= 0) {
    ctx.fillStyle = "rgba(80, 140, 255, 0.08)";
    ctx.fillRect(cellCol * cellW, cellRow * cellH, cellW, cellH);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  for (let i = 1; i < COLS; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellW, 0);
    ctx.lineTo(i * cellW, canvas.height);
    ctx.stroke();
  }
  for (let i = 1; i < ROWS; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * cellH);
    ctx.lineTo(canvas.width, i * cellH);
    ctx.stroke();
  }

  let live = 0;
  for (const item of beads.values()) {
    const at = cellOf(item.x, item.y);
    const inRoom = at.col === cellCol && at.row === cellRow;
    if (inRoom) live = live + 1;
    chase(item);
    const p = toScreen(item.px, item.py);
    const r = Math.max(4, item.size * (canvas.width / WORLD) * 0.55);
    ctx.fillStyle = hueColor(item.hue, inRoom ? item.light : item.light * 0.35);
    ctx.globalAlpha = inRoom ? 1 : 0.45;
    ctx.beginPath();
    if (item.shape === "square") {
      ctx.rect(p.x - r, p.y - r, r * 2, r * 2);
    } else {
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    if (item.size > 16) {
      ctx.strokeStyle = hueColor(item.hue, 1);
      ctx.lineWidth = 2;
      ctx.globalAlpha = inRoom ? 0.5 : 0.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 3.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  const me = toScreen(player.x, player.y);
  ctx.fillStyle = "#f3d36b";
  ctx.beginPath();
  ctx.arc(me.x, me.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.stroke();

  hud.textContent =
    "room " + cellCol + "," + cellRow +
    " · beads " + beads.size +
    " · live " + live +
    (backend ? " · " + backend : "") +
    " · WASD move · click to poke or drop";

  requestAnimationFrame(draw);
}

loadAll().then(() => {
  fetch("/health")
    .then((response) => response.json())
    .then((info) => {
      if (info && typeof info.instance === "string" && typeof info.role === "string") {
        backend = info.role + " " + info.instance.slice(0, 12);
      }
    })
    .catch(() => undefined);
  enterIfMoved();
  draw();
});
</script>
</body>
</html>
`;
