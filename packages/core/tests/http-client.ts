import http from "node:http";
import net from "node:net";

function requireStatus(statusCode: number | undefined): number {
  if (statusCode === undefined) {
    throw new Error("http status required");
  }
  return statusCode;
}

function statusFromHttp(raw: Buffer): number | null {
  const line = raw.toString("utf8").split("\r\n")[0];
  if (line === undefined) {
    return null;
  }
  const parts = line.split(" ");
  const code = parts[1];
  if (code === undefined) {
    return null;
  }
  const status = Number(code);
  if (Number.isInteger(status) === false) {
    return null;
  }
  return status;
}

export function httpPost(
  port: number,
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: requireStatus(res.statusCode),
            json: JSON.parse(Buffer.concat(chunks).toString("utf8")),
          });
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

export function httpGet(port: number, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path, method: "GET" }, (res) => {
      res.resume();
      resolve(requireStatus(res.statusCode));
    });
    req.on("error", reject);
    req.end();
  });
}

export function httpRaw(
  port: number,
  path: string,
  payload: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: requireStatus(res.statusCode),
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

export function httpAbort(port: number, path: string): Promise<number> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        res.resume();
        resolve(requireStatus(res.statusCode));
      },
    );
    req.on("error", () => {
      resolve(400);
    });
    req.write("{");
    req.destroy();
  });
}

export function httpSocketDrop(port: number, path: string): Promise<number> {
  return new Promise((resolve) => {
    let status: number | null = null;
    const client = net.connect({ port, host: "127.0.0.1" });
    client.on("connect", () => {
      client.write(
        `POST ${path} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 32\r\n\r\n{"filter":{"email":{"eq":"x"}}}`,
      );
      client.destroy();
    });
    client.on("data", (chunk: Buffer) => {
      status = statusFromHttp(chunk);
    });
    client.on("error", () => {
      resolve(400);
    });
    client.on("close", () => {
      if (status === null) {
        resolve(400);
        return;
      }
      resolve(status);
    });
  });
}

export function httpTruncateBody(port: number, path: string): Promise<number> {
  return new Promise((resolve) => {
    let status: number | null = null;
    const client = net.connect({ port, host: "127.0.0.1" });
    client.on("connect", () => {
      client.write(
        `POST ${path} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 64\r\n\r\n{"filter":`,
      );
      client.destroy();
    });
    client.on("data", (chunk: Buffer) => {
      status = statusFromHttp(chunk);
    });
    client.on("error", () => {
      resolve(400);
    });
    client.on("close", () => {
      if (status === null) {
        resolve(400);
        return;
      }
      resolve(status);
    });
  });
}
