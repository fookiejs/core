import { readFileSync, existsSync } from "node:fs";

const LCOV = process.argv[2] ?? "coverage/lcov.info";
const WANT = {
  lines: Number(process.argv[3] ?? 100),
  branches: Number(process.argv[4] ?? 100),
  functions: Number(process.argv[5] ?? 100),
};

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

const got = {
  lines: pct(totals.lh, totals.lf),
  branches: pct(totals.brh, totals.brf),
  functions: pct(totals.fnh, totals.fnf),
};

const failures = [];
for (const metric of ["lines", "branches", "functions"]) {
  const symbol = got[metric] >= WANT[metric] ? "ok  " : "FAIL";
  process.stdout.write(`${symbol} ${metric}: ${got[metric]}% (need ${WANT[metric]}%)\n`);
  if (got[metric] < WANT[metric]) {
    failures.push(`${metric} ${got[metric]}% < ${WANT[metric]}%`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`\ncoverage gate failed: ${failures.join(", ")}\n`);
  process.exit(1);
}
