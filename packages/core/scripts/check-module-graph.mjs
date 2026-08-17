import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve("src");
const ENTRIES = [join(ROOT, "index.ts")];

function walk(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      found.push(...walk(full));
      continue;
    }
    if (name.endsWith(".ts")) {
      found.push(full);
    }
  }
  return found;
}

const modules = walk(ROOT);
const importRe = /(?:from|import)\s+"(\.[^"]+)"/g;

const edges = new Map();
const broken = [];

for (const file of modules) {
  const text = readFileSync(file, "utf8");
  const targets = [];
  for (const match of text.matchAll(importRe)) {
    const spec = match[1];
    const target = resolve(dirname(file), spec);
    if (existsSync(target) === false) {
      broken.push(`${relative(ROOT, file)} imports "${spec}" which does not exist`);
      continue;
    }
    targets.push(target);
  }
  edges.set(file, targets);
}

const reached = new Set();
const queue = [...ENTRIES];
while (queue.length > 0) {
  const current = queue.pop();
  if (reached.has(current)) {
    continue;
  }
  reached.add(current);
  for (const next of edges.get(current) ?? []) {
    queue.push(next);
  }
}

const orphans = modules.filter((m) => reached.has(m) === false).map((m) => relative(ROOT, m));

process.stdout.write(`${modules.length} modules, ${reached.size} reachable from package exports\n`);

if (broken.length > 0) {
  process.stderr.write(`\nbroken import specifiers:\n${broken.map((b) => `  ${b}`).join("\n")}\n`);
}

if (orphans.length > 0) {
  process.stderr.write(
    `\nunreachable modules — nothing imports them, directly or transitively:\n${orphans
      .map((o) => `  src/${o.split("\\").join("/")}`)
      .join("\n")}\n`,
  );
}

if (broken.length > 0 || orphans.length > 0) {
  process.exit(1);
}

process.stdout.write("module graph is fully connected\n");
