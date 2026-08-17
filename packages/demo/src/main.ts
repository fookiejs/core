import http from "node:http";
import { analyze, defaultSensitiveKeys } from "@fookiejs/analyze";
import { graphqlServer } from "@fookiejs/graphql-server";
import { otlp } from "@fookiejs/otlp";
import { createFookie } from "./model.ts";
import { page } from "./page.ts";
import { createLive } from "./live.ts";
import { startMotion } from "./motion.ts";

const role = process.env.ROLE ?? "all";
const instance = process.env.HOSTNAME ?? "local";
const port = process.env.API_PORT ?? "3001";
const bind = process.env.API_BIND ?? "127.0.0.1";
const realtimePort = process.env.REALTIME_PORT ?? "4100";
const realtimeBind = process.env.REALTIME_BIND ?? "127.0.0.1";
const analyzePort = process.env.ANALYZE_PORT ?? "4300";
const analyzeToken = process.env.ANALYZE_TOKEN ?? "";
const analyzeBind = process.env.ANALYZE_BIND ?? "127.0.0.1";

await otlp("fookie-demo");

async function bootFookie() {
  const fookie = createFookie();
  fookie.run();
  const serving = await fookie.ready();
  if (serving === false) {
    console.error("postgres or redis is not reachable; check DATABASE_URL and REDIS_URL");
    process.exit(1);
  }
  return fookie;
}

function writeHealth(res: http.ServerResponse): void {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ role, instance }));
}

function isHealth(url: string): boolean {
  return url === "/health" || url.startsWith("/health?");
}

async function runAll(): Promise<void> {
  const fookie = await bootFookie();
  const wired = createLive(fookie);
  const graph = graphqlServer(fookie, {
    port: [],
    limits: [],
    snapshot: false,
    budget: [],
    realtime: [wired.live],
  });
  const board = analyze(fookie, {
    port: [analyzePort],
    token: analyzeToken.length > 0 ? [analyzeToken] : [],
    bind: [analyzeBind],
    deny: defaultSensitiveKeys,
  });
  const motion = await startMotion(fookie);
  const server = http.createServer((req, res) => {
    const url = String(req.url);
    if (req.method === "GET" && isHealth(url)) {
      writeHealth(res);
      return;
    }
    if (req.method === "GET" && (url === "/" || url === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page);
      return;
    }
    void graph.handle(req, res);
  });
  server.listen(Number(port), bind, () => {
    console.log(`space    http://${bind}:${port}`);
    console.log(`analyze  http://${analyzeBind}:${analyzePort}/?token=${board.accessToken()}`);
  });
  process.on("SIGINT", () => {
    motion.stop();
    server.close();
    void wired.stop();
    void graph.stop();
    void board.stop();
    void fookie.stop();
    process.exit(0);
  });
}

async function runApi(): Promise<void> {
  const fookie = await bootFookie();
  const graph = graphqlServer(fookie, {
    port: [],
    limits: [],
    snapshot: false,
    budget: [],
    realtime: [],
  });
  const server = http.createServer((req, res) => {
    const url = String(req.url);
    if (req.method === "GET" && isHealth(url)) {
      writeHealth(res);
      return;
    }
    if (req.method === "GET" && (url === "/" || url === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page);
      return;
    }
    void graph.handle(req, res);
  });
  server.listen(Number(port), bind, () => {
    console.log(`api      http://${bind}:${port}  ${instance}`);
  });
  process.on("SIGINT", () => {
    server.close();
    void graph.stop();
    void fookie.stop();
    process.exit(0);
  });
}

async function runRealtime(): Promise<void> {
  const fookie = await bootFookie();
  const wired = createLive(fookie);
  const server = http.createServer((req, res) => {
    const url = String(req.url);
    if (req.method === "GET" && isHealth(url)) {
      writeHealth(res);
      return;
    }
    void wired.live.handle(req, res);
  });
  server.listen(Number(realtimePort), realtimeBind, () => {
    console.log(`realtime http://${realtimeBind}:${realtimePort}  ${instance}`);
  });
  process.on("SIGINT", () => {
    server.close();
    void wired.stop();
    void fookie.stop();
    process.exit(0);
  });
}

async function runTick(): Promise<void> {
  const fookie = await bootFookie();
  const motion = await startMotion(fookie);
  console.log(`tick     ${instance}`);
  process.on("SIGINT", () => {
    motion.stop();
    void fookie.stop();
    process.exit(0);
  });
}

async function runAnalyze(): Promise<void> {
  const fookie = await bootFookie();
  const board = analyze(fookie, {
    port: [analyzePort],
    token: analyzeToken.length > 0 ? [analyzeToken] : [],
    bind: [analyzeBind],
    deny: defaultSensitiveKeys,
  });
  console.log(`analyze  http://${analyzeBind}:${analyzePort}/?token=${board.accessToken()}`);
  process.on("SIGINT", () => {
    void board.stop();
    void fookie.stop();
    process.exit(0);
  });
}

if (role === "api") {
  await runApi();
} else if (role === "realtime") {
  await runRealtime();
} else if (role === "tick") {
  await runTick();
} else if (role === "analyze") {
  await runAnalyze();
} else {
  await runAll();
}
