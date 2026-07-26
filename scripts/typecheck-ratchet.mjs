import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASELINE = new URL("./typecheck-baseline.json", import.meta.url);
const PROJECT = "tsconfig.lint.json";
const TSC = fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url));

if (existsSync(TSC) === false) {
  process.stderr.write(`cannot find tsc at ${TSC} — run npm ci first\n`);
  process.exit(2);
}

const run = spawnSync(process.execPath, [TSC, "-p", PROJECT, "--noEmit"], { encoding: "utf8" });

if (run.error !== undefined) {
  process.stderr.write(`failed to run tsc: ${run.error.message}\n`);
  process.exit(2);
}

const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
const errorLines = output.split(/\r?\n/).filter((line) => / error TS\d+: /.test(line));

// A clean exit code with no parsed errors is trustworthy; a failing exit code with none
// parsed means tsc broke in a way this script did not understand. Never report success then.
if (run.status !== 0 && errorLines.length === 0) {
  process.stderr.write(`tsc exited ${run.status} but produced no parsable errors:\n${output}\n`);
  process.exit(2);
}

const perFile = new Map();
for (const line of errorLines) {
  const match = /^(.+?)\(\d+,\d+\): error TS/.exec(line);
  const file = match === null ? "unknown" : match[1].split("\\").join("/");
  perFile.set(file, (perFile.get(file) ?? 0) + 1);
}

const actual = { total: errorLines.length, files: Object.fromEntries([...perFile].sort()) };

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, `${JSON.stringify(actual, undefined, 2)}\n`);
  process.stdout.write(`baseline written: ${actual.total} errors\n`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));

process.stdout.write(`typecheck (src + tests + example): ${actual.total} errors\n`);
process.stdout.write(`baseline: ${baseline.total}\n\n`);

const regressed = [];
for (const [file, count] of Object.entries(actual.files)) {
  const allowed = baseline.files[file] ?? 0;
  if (count > allowed) {
    regressed.push(`  ${file}: ${count} errors (baseline ${allowed})`);
  }
}

const improved = [];
for (const [file, allowed] of Object.entries(baseline.files)) {
  const count = actual.files[file] ?? 0;
  if (count < allowed) {
    improved.push(`  ${file}: ${count} errors (was ${allowed})`);
  }
}

if (improved.length > 0) {
  process.stdout.write(`improved:\n${improved.join("\n")}\n\n`);
}

if (regressed.length > 0) {
  process.stdout.write(`REGRESSED — new type errors are not allowed:\n${regressed.join("\n")}\n\n`);
  process.stdout.write(
    `Fix them, or if the file is genuinely new work, refresh the baseline with:\n`,
  );
  process.stdout.write(`  node scripts/typecheck-ratchet.mjs --write\n`);
  process.exit(1);
}

if (improved.length > 0) {
  process.stdout.write(
    `Ratchet moved down. Lock it in:\n  node scripts/typecheck-ratchet.mjs --write\n`,
  );
}

process.stdout.write("no regressions\n");
