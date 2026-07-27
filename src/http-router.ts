import { z } from "zod";
import http from "node:http";
import { executeRun, resolveModelByName } from "./engine/flow.ts";
import type { FlowRun } from "./engine/flow.ts";
import { uuidV7 } from "./engine/ids.ts";
import { isFailureClass } from "./external.ts";
import type { FailureClass } from "./external.ts";
import type { Runtime } from "./engine/runtime.ts";
import {
  filterFromPayload,
  pathPartAt,
  pathPartsFrom,
  readJsonBody,
  recordFromPayload,
  requireFilterInput,
  requireHttpPayload,
  sendJson,
} from "./http.ts";
import type { ModelDef, ModelFieldsInput } from "./model.ts";
import { catchValidation, firstPresent } from "./slot.ts";
import { uuidSchema } from "./types/pg-literals.ts";
import { Done, Failed, Running } from "./signal.ts";
import type { Signal } from "./signal.ts";
import type { EntityRecord, JsonValue } from "./values.ts";

export type RegisteredModel = ModelDef<ModelFieldsInput>;

export type RouterPorts = {
  registeredModels: readonly RegisteredModel[];
  runs: Map<string, FlowRun<ModelFieldsInput>>;
  runtimeFor(
    traceId: string,
    model: ModelDef<ModelFieldsInput>,
    entityId: string,
    operation: string,
  ): Runtime;
  finalizeRun(runId: string, run: FlowRun<ModelFieldsInput>, signal: Signal): void;
  setExternalResult(input: { externalId: string; output: JsonValue }): Promise<boolean>;
  setExternalFailure(input: {
    externalId: string;
    reason: string;
    failure: FailureClass;
  }): Promise<boolean>;
  publishListResults(signal: Signal, rows: readonly EntityRecord[]): void;
};

export async function routeHttp(
  ports: RouterPorts,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  if (req.headers["x-fookie-test-throw"] === "1") {
    throw new Error("test");
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "method not allowed" });
    return;
  }
  const payloadHits = await readJsonBody(req);
  if (payloadHits.length < 1) {
    sendJson(res, 400, { error: "invalid body" });
    return;
  }
  const payload = requireHttpPayload(payloadHits, "invalid body");
  const requestUrlParsed = z.string().safeParse(req.url);
  if (requestUrlParsed.success === false) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  const url = new URL(requestUrlParsed.data, "http://local");
  const parts = pathPartsFrom(url.pathname);
  const routeHeadHits = pathPartAt(parts, 0);
  const routeNextHits = pathPartAt(parts, 1);
  if (routeHeadHits[0] === "external" && routeNextHits[0] === "result") {
    if (parts.length !== 2) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const externalIdParsed = z.string().min(1).safeParse(payload.externalId);
    if (externalIdParsed.success === false) {
      sendJson(res, 400, { error: "invalid externalId" });
      return;
    }
    const outputHits = recordFromPayload(payload, "output");
    if (outputHits.length < 1) {
      sendJson(res, 400, { error: "invalid output" });
      return;
    }
    for (const output of outputHits) {
      const accepted = await ports.setExternalResult({
        externalId: externalIdParsed.data,
        output,
      });
      if (accepted === true) {
        sendJson(res, 200, { signal: Done });
        return;
      }
      sendJson(res, 400, { error: "external result rejected" });
      return;
    }
    sendJson(res, 400, { error: "invalid output" });
    return;
  }
  if (routeHeadHits[0] === "external" && routeNextHits[0] === "failure") {
    if (parts.length !== 2) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const failureIdParsed = z.string().min(1).safeParse(payload.externalId);
    if (failureIdParsed.success === false) {
      sendJson(res, 400, { error: "invalid externalId" });
      return;
    }
    const reasonParsed = z.string().min(1).safeParse(payload.reason);
    if (reasonParsed.success === false) {
      sendJson(res, 400, { error: "invalid reason" });
      return;
    }
    const classParsed = z.string().min(1).safeParse(payload.failure);
    if (classParsed.success === false) {
      sendJson(res, 400, { error: "invalid failure class" });
      return;
    }
    if (isFailureClass(classParsed.data) === false) {
      sendJson(res, 400, { error: "invalid failure class" });
      return;
    }
    const recorded = await ports.setExternalFailure({
      externalId: failureIdParsed.data,
      reason: reasonParsed.data,
      failure: classParsed.data,
    });
    if (recorded === true) {
      sendJson(res, 200, { signal: Done });
      return;
    }
    sendJson(res, 400, { error: "external failure rejected" });
    return;
  }
  if (parts.length < 2) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  const modelNameHits = pathPartAt(parts, 0);
  const actionHits = pathPartAt(parts, 1);
  if (modelNameHits.length < 1 || actionHits.length < 1) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  const modelName = firstPresent(modelNameHits, "model name required");
  const action = firstPresent(actionHits, "action required");
  const modelHits = resolveModelByName(ports.registeredModels, modelName);
  if (modelHits.length < 1) {
    sendJson(res, 404, { error: "model not found" });
    return;
  }
  const model = firstPresent(modelHits, "model required");
  if (action === "create") {
    if (parts.length !== 2) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const bodyHits = recordFromPayload(payload, "body");
    if (bodyHits.length < 1) {
      sendJson(res, 400, { error: "invalid body" });
      return;
    }
    const body = firstPresent(bodyHits, "http body required");
    const validatedHits = catchValidation(() => model.validateCreateBody(body));
    if (validatedHits.length < 1) {
      sendJson(res, 400, { error: "invalid body" });
      return;
    }
    const validated = firstPresent(validatedHits, "validated body required");
    const runId = uuidV7();
    const entityId = uuidV7();
    const run: FlowRun<ModelFieldsInput> = {
      id: runId,
      model,
      operation: "create",
      entityId,
      body: [validated],
      filter: [],
      entity: [],
      created: [],
      results: [],
      signal: Running,
    };
    ports.runs.set(runId, run);
    const signal = await executeRun(ports.runtimeFor(runId, model, entityId, "create"), run);
    ports.finalizeRun(runId, run, signal);
    if (signal === Done) {
      for (const created of run.created) {
        sendJson(res, 200, { signal: Done, id: entityId, runId, entity: created });
        return;
      }
    }
    if (signal === Running) {
      sendJson(res, 200, { signal: Running, id: entityId, runId });
      return;
    }
    sendJson(res, 200, { signal: Failed, id: entityId, runId });
    return;
  }
  if (action === "list") {
    if (parts.length !== 2) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const listFilterHits = filterFromPayload(model, payload, "list");
    if (listFilterHits.length < 1) {
      sendJson(res, 400, { error: "invalid filter" });
      return;
    }
    const filter = requireFilterInput(listFilterHits, "invalid filter");
    const runId = uuidV7();
    const run: FlowRun<ModelFieldsInput> = {
      id: runId,
      model,
      operation: "list",
      entityId: runId,
      body: [],
      filter: [filter],
      entity: [],
      created: [],
      results: [],
      signal: Running,
    };
    ports.runs.set(runId, run);
    const signal = await executeRun(ports.runtimeFor(runId, model, runId, "list"), run);
    ports.finalizeRun(runId, run, signal);
    ports.publishListResults(signal, run.results);
    sendJson(res, 200, { signal, results: run.results });
    return;
  }
  if (parts.length !== 3) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  const entityIdHits = pathPartAt(parts, 1);
  const mutationHits = pathPartAt(parts, 2);
  if (entityIdHits.length < 1 || mutationHits.length < 1) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  const entityId = firstPresent(entityIdHits, "entity id required");
  const mutation = firstPresent(mutationHits, "mutation required");
  if (mutation !== "update" && mutation !== "delete") {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  if (uuidSchema.safeParse(entityId).success === false) {
    sendJson(res, 400, { error: "invalid id" });
    return;
  }
  if (mutation === "update") {
    const updateFilterHits = filterFromPayload(model, payload, "update");
    if (updateFilterHits.length < 1) {
      sendJson(res, 400, { error: "invalid filter" });
      return;
    }
    const filter = requireFilterInput(updateFilterHits, "invalid filter");
    const bodyHits = recordFromPayload(payload, "body");
    if (bodyHits.length < 1) {
      sendJson(res, 400, { error: "invalid body" });
      return;
    }
    const updateBody = firstPresent(bodyHits, "http update body required");
    const bodyValidHits = catchValidation(() => model.validateUpdateBody(updateBody));
    if (bodyValidHits.length < 1) {
      sendJson(res, 400, { error: "invalid body" });
      return;
    }
    const bodyValid = firstPresent(bodyValidHits, "update body required");
    const runId = uuidV7();
    const run: FlowRun<ModelFieldsInput> = {
      id: runId,
      model,
      operation: "update",
      entityId,
      body: [bodyValid],
      filter: [filter],
      entity: [],
      created: [],
      results: [],
      signal: Running,
    };
    ports.runs.set(runId, run);
    const signal = await executeRun(ports.runtimeFor(runId, model, entityId, "update"), run);
    ports.finalizeRun(runId, run, signal);
    sendJson(res, 200, { signal });
    return;
  }
  if (mutation === "delete") {
    const deleteFilterHits = filterFromPayload(model, payload, "delete");
    if (deleteFilterHits.length < 1) {
      sendJson(res, 400, { error: "invalid filter" });
      return;
    }
    const filter = requireFilterInput(deleteFilterHits, "invalid filter");
    const runId = uuidV7();
    const run: FlowRun<ModelFieldsInput> = {
      id: runId,
      model,
      operation: "delete",
      entityId,
      body: [],
      filter: [filter],
      entity: [],
      created: [],
      results: [],
      signal: Running,
    };
    ports.runs.set(runId, run);
    const signal = await executeRun(ports.runtimeFor(runId, model, entityId, "delete"), run);
    ports.finalizeRun(runId, run, signal);
    sendJson(res, 200, { signal });
  }
}
