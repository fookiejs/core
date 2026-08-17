import { spawnSync } from "node:child_process";
import pg from "pg";

const containerName = "fookie-test-pg";
const image = "postgres:18";
const user = "postgres";
const password = "postgres";
const dbName = "fookie_test";
const hostPort = "55432";

let pending: Promise<string> | undefined;

type DockerResult = {
  status: number;
  stdout: string;
  stderr: string;
};

function docker(args: readonly string[]): DockerResult {
  const result = spawnSync("docker", args.slice(), { encoding: "utf8" });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status === null) {
    throw new Error("docker produced no exit status");
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function dockerError(result: DockerResult): Error {
  const stderr = result.stderr.trim();
  if (stderr.length > 0) {
    return new Error(stderr);
  }
  const stdout = result.stdout.trim();
  if (stdout.length > 0) {
    return new Error(stdout);
  }
  return new Error("test postgres container failed");
}

function containerExists(): boolean {
  const result = docker(["inspect", "-f", "{{.Id}}", containerName]);
  return result.status === 0 && result.stdout.trim().length > 0;
}

function containerRunning(): boolean {
  const result = docker(["inspect", "-f", "{{.State.Running}}", containerName]);
  return result.status === 0 && result.stdout.trim() === "true";
}

function publishedPort(): string {
  const result = docker([
    "inspect",
    "-f",
    '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
    containerName,
  ]);
  if (result.status !== 0) {
    throw dockerError(result);
  }
  const port = result.stdout.trim();
  if (port.length < 1) {
    throw new Error("test postgres has no published port");
  }
  return port;
}

function connectionUrl(port: string): string {
  return `postgres://${user}:${password}@127.0.0.1:${port}/${dbName}`;
}

function startContainer(): void {
  if (containerRunning()) {
    return;
  }
  if (containerExists()) {
    const started = docker(["start", containerName]);
    if (started.status !== 0) {
      throw dockerError(started);
    }
    return;
  }
  const created = docker([
    "run",
    "-d",
    "--name",
    containerName,
    "-e",
    `POSTGRES_USER=${user}`,
    "-e",
    `POSTGRES_PASSWORD=${password}`,
    "-e",
    `POSTGRES_DB=${dbName}`,
    "-p",
    `${hostPort}:5432`,
    image,
  ]);
  if (created.status === 0) {
    return;
  }
  if (containerExists()) {
    if (containerRunning() === false) {
      const started = docker(["start", containerName]);
      if (started.status !== 0) {
        throw dockerError(started);
      }
    }
    return;
  }
  throw dockerError(created);
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilReady(url: string): Promise<void> {
  let last: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const client = new pg.Client({ connectionString: url });
    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return;
    } catch (err) {
      last = err;
      await client.end().catch(() => undefined);
      await pause(250);
    }
  }
  if (last instanceof Error) {
    throw last;
  }
  throw new Error("test postgres did not become ready");
}

async function startDockerPostgres(): Promise<string> {
  startContainer();
  const url = connectionUrl(publishedPort());
  await waitUntilReady(url);
  return url;
}

async function resolveUrl(): Promise<string> {
  const fromEnv = process.env.FOOKIE_TEST_DATABASE;
  if (fromEnv !== undefined) {
    if (fromEnv.length < 1) {
      throw new Error("FOOKIE_TEST_DATABASE is empty");
    }
    return fromEnv;
  }
  return startDockerPostgres();
}

export function ensureTestPostgres(): Promise<string> {
  if (pending !== undefined) {
    return pending;
  }
  pending = resolveUrl();
  return pending;
}
