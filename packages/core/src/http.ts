import { z } from "zod";
import http from "node:http";
import { emptyFilterInput } from "./engine/runtime.ts";
import { FookieError, ModelFieldError, NotFoundError, ValidationError } from "./errors.ts";
import type { FilterInput } from "./filter/schema.ts";
import type { ModelDef, ModelFieldsInput } from "./model.ts";
import type { Signal } from "./signal.ts";
import { appendItem, catchValidation } from "./slot.ts";
import { isJsonObject } from "./values.ts";
import type { CaughtFailure, EntityRecord, JsonObject, JsonValue } from "./values.ts";

export type HttpPayload = JsonObject;

export function readJsonBody(req: http.IncomingMessage): Promise<readonly HttpPayload[]> {
  return new Promise((resolve) => {
    let chunks: readonly Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      if (Buffer.isBuffer(chunk) === false) {
        return;
      }
      if (chunk.length < 1) {
        return;
      }
      chunks = appendItem(chunks, chunk);
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks.slice()).toString("utf8"));
        if (isJsonObject(parsed) === true) {
          resolve([parsed]);
          return;
        }
        resolve([]);
      } catch {
        resolve([]);
      }
    });
    req.on("error", () => resolve([]));
  });
}

export type HttpJsonFieldKinds = {
  text: string;
  number: number;
  boolean: boolean;
  entity: EntityRecord;
  entities: EntityRecord[];
  ids: string[];
  signal: Signal;
};

export type HttpJsonField = HttpJsonFieldKinds[keyof HttpJsonFieldKinds];

export function sendJson(
  res: http.ServerResponse,
  status: number,
  payload: Record<string, HttpJsonField>,
): void {
  if (Number.isInteger(status) === false || status < 100 || status > 599) {
    throw ValidationError.create("http status required");
  }
  if (z.looseObject({}).safeParse(payload).success === false) {
    throw ValidationError.create("http payload required");
  }
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

export function listenPort(listen: string): readonly number[] {
  if (listen.length < 1) {
    return [];
  }
  if (/^\d+$/.test(listen) === false) {
    return [];
  }
  const port = Number(listen);
  if (Number.isInteger(port) === false || port < 0 || port > 65535) {
    return [];
  }
  return [port];
}

export function pathPartsFrom(pathname: string): string[] {
  let parts: readonly string[] = [];
  for (const part of pathname.split("/")) {
    if (part.length < 1) {
      continue;
    }
    try {
      const decoded = decodeURIComponent(part);
      if (decoded.length > 0) {
        parts = appendItem(parts, decoded);
      }
    } catch {
      return [];
    }
  }
  return parts.slice();
}

export function pathPartAt(parts: readonly string[], index: number): readonly string[] {
  let current = 0;
  for (const part of parts) {
    if (current === index) {
      if (part.length === 0) {
        return [];
      }
      return [part];
    }
    current += 1;
  }
  return [];
}

export function httpStatusForFookieError(err: CaughtFailure): number {
  if (err instanceof ValidationError || err instanceof ModelFieldError) {
    return 400;
  }
  if (err instanceof NotFoundError) {
    return 404;
  }
  return 500;
}

export function httpErrorPayload(err: CaughtFailure): { error: string } {
  if (err instanceof FookieError) {
    if (err.message.length < 1) {
      return { error: "internal error" };
    }
    return { error: err.message };
  }
  return { error: "internal error" };
}

export function recordFromPayload(payload: HttpPayload, key: string): JsonObject[] {
  if (z.string().min(1).safeParse(key).success === false) {
    throw ValidationError.create("payload key required");
  }
  for (const [entryKey, entryValue] of Object.entries(payload)) {
    if (entryKey === key && isJsonObject(entryValue)) {
      return [entryValue];
    }
  }
  return [];
}

export type FilterPayloadKindKinds = {
  list: "list";
  update: "update";
  delete: "delete";
};

export type FilterPayloadKind = FilterPayloadKindKinds[keyof FilterPayloadKindKinds];

export function filterFromPayload(
  model: ModelDef<ModelFieldsInput>,
  payload: HttpPayload,
  kind: FilterPayloadKind,
): readonly FilterInput[] {
  const rawHits = recordFromPayload(payload, "filter");
  let filterValueHits: JsonValue[] = [];
  if (rawHits.length < 1) {
    let filterPresent = false;
    for (const [entryKey] of Object.entries(payload)) {
      if (entryKey === "filter") {
        filterPresent = true;
      }
    }
    if (filterPresent === true) {
      return [];
    }
    filterValueHits = [emptyFilterInput()];
  } else {
    for (const hit of rawHits) {
      filterValueHits = [hit];
      break;
    }
  }
  let filterValue: JsonValue = emptyFilterInput();
  for (const hit of filterValueHits) {
    filterValue = hit;
  }
  let validatedHits: FilterInput[];
  if (kind === "list") {
    validatedHits = catchValidation(() => model.validateListFilter(filterValue));
  } else if (kind === "update") {
    validatedHits = catchValidation(() => model.validateUpdateFilter(filterValue));
  } else {
    validatedHits = catchValidation(() => model.validateDeleteFilter(filterValue));
  }
  if (validatedHits.length < 1) {
    return [];
  }
  return validatedHits;
}
