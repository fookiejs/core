import type { Options } from "../option.ts";
import type { Payload, ConstructorOf } from "../payload.ts";
import * as lodash from "https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js";
import pre_rule from "./lifecycles/pre-rule.ts";
import modify from "./lifecycles/modify.ts";
import role from "./lifecycles/role.ts";
import rule from "./lifecycles/rule.ts";
import effect from "./lifecycles/effect.ts";
import filter from "./lifecycles/filter.ts";
import globalEffect from "./lifecycles/global_effect.ts";
import { FookieError } from "../error.ts";
import { plainToInstance } from "class-transformer";
import type { Model, QueryType } from "../model/model.ts";
import { Method } from "../method.ts";
import type { MethodResponse } from "../response.ts";

function createPayload<T extends Model, M extends Method>(
  payload: Omit<Payload<T, M>, "runId" | "state">
): Payload<T, M> {
  return {
    ...payload,
    runId: "abc",
    state: {},
  };
}

async function runLifecycle<T extends Model, M extends Method>(
  payload: Payload<T, M>,
  method: (payload: Payload<T, M>) => Promise<MethodResponse<T>[M]>
) {
  if (await pre_rule(payload)) {
    await modify(payload);
    if (await role(payload)) {
      if (await rule(payload)) {
        const response = plainToInstance(
          payload.model,
          lodash.isString(payload.state.cachedResponse)
            ? JSON.parse(payload.state.cachedResponse!)
            : await method(payload)
        ) as MethodResponse<T>[M];

        await filter(payload, response);
        await effect(payload, response);
        await globalEffect(payload, response);

        return response;
      }
    }
  }

  throw FookieError.create({
    validationErrors: {},
    message: "core error",
    name: "unknown",
  });
}

export function createRun<T extends Model>(
  method: (payload: Payload<T, Method.CREATE>) => Promise<T>
) {
  return async function (this: typeof Model, body: T, options: Options = {}) {
    const payload = createPayload({
      method: Method.CREATE,
      body,
      options,
      model: this as unknown as ConstructorOf<T>,
      query: {
        limit: Infinity,
        offset: 0,
        attributes: [],
        filter: {},
      },
    });
    return runLifecycle(payload, method);
  };
}

export function readRun<T extends Model>(
  method: (payload: Payload<T, Method.READ>) => Promise<T[]>
) {
  return async function (
    this: typeof Model,
    query: QueryType<T>,
    options: Options = {}
  ) {
    const payload = createPayload({
      method: Method.READ,
      query,
      options,
      model: this as unknown as ConstructorOf<T>,
      body: {},
    });
    return runLifecycle(payload, method);
  };
}

export function updateRun<T extends Model>(
  method: (payload: Payload<T, Method.UPDATE>) => Promise<boolean>
) {
  return async function (
    this: typeof Model,
    query: QueryType<T>,
    body: Partial<T>,
    options: Options = {}
  ) {
    const payload = createPayload({
      method: Method.UPDATE,
      query,
      body,
      options,
      model: this as unknown as ConstructorOf<T>,
    });
    return runLifecycle(payload, method);
  };
}

export function deleteRun<T extends Model>(
  method: (payload: Payload<T, Method.DELETE>) => Promise<boolean>
) {
  return async function (
    this: typeof Model,
    query: QueryType<T>,
    options: Options = {}
  ) {
    const payload = createPayload({
      method: Method.DELETE,
      query,
      options,
      model: this as unknown as ConstructorOf<T>,
      body: {},
    });
    return runLifecycle(payload, method);
  };
}
