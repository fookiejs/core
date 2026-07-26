import { readFileSync, existsSync } from "node:fs";

const LCOV = process.argv[2] ?? "coverage/lcov.info";
const LABEL = process.argv[3] ?? "";

if (existsSync(LCOV) === false) {
  process.stderr.write(`no lcov file at ${LCOV}\n`);
  process.exit(2);
}

const records = [];
let currentFile = "";
let counters = { lf: 0, lh: 0, brf: 0, brh: 0, fnf: 0, fnh: 0 };

function flush() {
  if (currentFile.length > 0) {
    records.push({ file: currentFile, ...counters });
  }
  currentFile = "";
  counters = { lf: 0, lh: 0, brf: 0, brh: 0, fnf: 0, fnh: 0 };
}

for (const line of readFileSync(LCOV, "utf8").split(/\r?\n/)) {
  if (line.startsWith("SF:")) {
    flush();
    currentFile = line.slice(3).split("\\").join("/");
    const cut = currentFile.lastIndexOf("/src/");
    if (cut !== -1) {
      currentFile = currentFile.slice(cut + 1);
    }
    continue;
  }
  const eq = line.indexOf(":");
  if (eq === -1) {
    continue;
  }
  const key = line.slice(0, eq).toLowerCase();
  const value = Number(line.slice(eq + 1));
  if (Number.isFinite(value) && Object.hasOwn(counters, key)) {
    counters[key] = value;
  }
  if (line === "end_of_record") {
    flush();
  }
}
flush();

function pct(hit, found) {
  if (found === 0) {
    return 100;
  }
  return Math.round((hit / found) * 10000) / 100;
}

const rows = records.map((r) => ({
  file: r.file,
  lines: pct(r.lh, r.lf),
  branches: pct(r.brh, r.brf),
  funcs: pct(r.fnh, r.fnf),
  uncovered: r.lf - r.lh,
}));

const total = records.reduce(
  (acc, r) => ({
    lf: acc.lf + r.lf,
    lh: acc.lh + r.lh,
    brf: acc.brf + r.brf,
    brh: acc.brh + r.brh,
    fnf: acc.fnf + r.fnf,
    fnh: acc.fnh + r.fnh,
  }),
  { lf: 0, lh: 0, brf: 0, brh: 0, fnf: 0, fnh: 0 },
);

const overall = {
  lines: pct(total.lh, total.lf),
  branches: pct(total.brh, total.brf),
  funcs: pct(total.fnh, total.fnf),
};

function bar(value) {
  const filled = Math.round(value / 10);
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
}

const worst = rows.toSorted((a, b) => a.branches - b.branches || a.lines - b.lines);

const out = [];
out.push(`## Coverage${LABEL.length > 0 ? ` — ${LABEL}` : ""}`);
out.push("");
out.push(
  `**${overall.lines}%** lines · **${overall.branches}%** branches · **${overall.funcs}%** functions  ${bar(overall.lines)}`,
);
out.push("");
out.push(`<details><summary>Per-module breakdown (${rows.length} modules)</summary>`);
out.push("");
out.push("| module | lines | branches | funcs | uncovered lines |");
out.push("| --- | --- | --- | --- | --- |");
for (const r of worst) {
  out.push(`| \`${r.file}\` | ${r.lines}% | ${r.branches}% | ${r.funcs}% | ${r.uncovered} |`);
}
out.push("");
out.push("</details>");
out.push("");
out.push(`<sub>Sorted worst-first by branch coverage. Generated from \`${LCOV}\`.</sub>`);

process.stdout.write(`${out.join("\n")}\n`);
