import { spawnSync } from "node:child_process";
import { readWorkspacePackages, root, topoPackages } from "./workspaces.mjs";

function npmViewVersion(name) {
  const result = spawnSync("npm", ["view", name, "version"], {
    encoding: "utf8",
    cwd: root,
  });
  if (result.status !== 0) {
    return "";
  }
  return result.stdout.trim();
}

function publish(dir) {
  const result = spawnSync("npm", ["publish", "--access", "public"], {
    cwd: dir,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`publish failed in ${dir}`);
  }
}

const build = spawnSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) {
  throw new Error("workspace build failed");
}

const ordered = topoPackages(readWorkspacePackages()).filter((item) => item.pkg.private !== true);

let published = 0;
for (const item of ordered) {
  const publishedVersion = npmViewVersion(item.pkg.name);
  if (publishedVersion === item.pkg.version) {
    console.log(`skip ${item.pkg.name}@${item.pkg.version} already on npm`);
    continue;
  }
  const remote = publishedVersion.length > 0 ? publishedVersion : "nothing";
  console.log(`publish ${item.pkg.name}@${item.pkg.version} (npm has ${remote})`);
  publish(item.dir);
  published = published + 1;
}

console.log(`published ${published} package(s)`);
