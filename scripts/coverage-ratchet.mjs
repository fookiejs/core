import { readFileSync, writeFileSync, existsSync } from "node:fs";

const LCOV = process.argv[2] ?? "coverage/lcov.info";
const BASELINE = new URL("./coverage-baseline.json", import.meta.url);

const TOLERANCE = 2;

if (existsSync(LCOV) === false) {
  process.stderr.write(`no lcov file at ${LCOV} — did the test run emit one?\n`);
  process.exit(2);
}

const totals = { lf: 0, lh: 0, brf: 0, brh: 0, fnf: 0, fnh: 0 };
for (const line of readFileSync(LCOV, "utf8").split(/\r?\n/)) {
  const eq = line.indexOf(":");
  if (eq === -1) {
    continue;
  }
  const key = line.slice(0, eq).toLowerCase();
  const value = Number(line.slice(eq + 1));
  if (Number.isFinite(value) && Object.hasOwn(totals, key)) {
    totals[key] += value;
  }
}

if (totals.lf === 0) {
  process.stderr.write(`lcov file at ${LCOV} contains no line records\n`);
  process.exit(2);
}

function pct(hit, found) {
  if (found === 0) {
    return 100;
  }
  return Math.round((hit / found) * 10000) / 100;
}

const actual = {
  lines: pct(totals.lh, totals.lf),
  branches: pct(totals.brh, totals.brf),
  functions: pct(totals.fnh, totals.fnf),
};

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, `${JSON.stringify(actual, undefined, 2)}\n`);
  process.stdout.write(
    `baseline written: ${actual.lines}% lines, ${actual.branches}% branches, ${actual.functions}% functions\n`,
  );
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));

const regressed = [];
const improved = [];
for (const metric of ["lines", "branches", "functions"]) {
  const was = baseline[metric];
  const now = actual[metric];
  const mark = now + TOLERANCE < was ? "DOWN" : "ok  ";
  process.stdout.write(`${mark} ${metric}: ${now}% (baseline ${was}%)\n`);
  if (now + TOLERANCE < was) {
    regressed.push(`${metric} fell from ${was}% to ${now}%`);
  }
  if (now > was) {
    improved.push(`${metric} ${was}% -> ${now}%`);
  }
}

if (regressed.length > 0) {
  process.stderr.write(`\ncoverage regressed: ${regressed.join(", ")}\n`);
  process.stderr.write(`Add tests for what you changed, or if the drop is intended run:\n`);
  process.stderr.write(`  node scripts/coverage-ratchet.mjs coverage/lcov.info --write\n`);
  process.exit(1);
}

if (improved.length > 0) {
  process.stdout.write(`\nimproved: ${improved.join(", ")}\n`);
  process.stdout.write(
    `Lock it in:\n  node scripts/coverage-ratchet.mjs coverage/lcov.info --write\n`,
  );
}
