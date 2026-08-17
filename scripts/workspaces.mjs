import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const root = join(import.meta.dirname, "..");
const packagesDir = join(root, "packages");

export function readWorkspacePackages() {
  const names = readdirSync(packagesDir);
  const packages = [];
  for (const name of names) {
    const dir = join(packagesDir, name);
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    if (pkg.name === undefined) {
      throw new Error(`package name missing in ${dir}`);
    }
    packages.push({ dir, pkg });
  }
  return packages;
}

function workspaceNames(pkg) {
  const names = [];
  const blocks = [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies];
  for (const block of blocks) {
    if (block === undefined) {
      continue;
    }
    for (const name of Object.keys(block)) {
      names.push(name);
    }
  }
  return names;
}

export function topoPackages(packages) {
  const remaining = packages.slice();
  const ordered = [];
  while (remaining.length > 0) {
    const next = remaining.findIndex((item) => {
      const deps = workspaceNames(item.pkg);
      for (const dep of deps) {
        const still = remaining.some((other) => other.pkg.name === dep);
        if (still) {
          return false;
        }
      }
      return true;
    });
    if (next < 0) {
      throw new Error("workspace dependency cycle");
    }
    ordered.push(remaining[next]);
    remaining.splice(next, 1);
  }
  return ordered;
}
