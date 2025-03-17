import type { Effect, Rule } from "../../lifecycle-function.ts";
import type { Method } from "../../method.ts";
import type { Model } from "../../model/model.ts";
import db_disconnect from "../effect/db_disconnect.ts";
import default_payload from "../modify/default_payload.ts";
import db_connect from "../rule/db_connect.ts";
import has_body from "../rule/has_body.ts";
import has_method from "../rule/has_method.ts";
import validate_attributes from "../rule/validate_attributes.ts";
import validate_payload from "../rule/validate_payload.ts";

export const globalRules: Rule<Model, Method>[] = [
  validate_payload,
  default_payload,
  validate_payload,
  has_method,
  has_body,
  validate_attributes,
  db_connect,
] as const;

export const globalEffects: Effect<Model, Method>[] = [db_disconnect] as const;

export function addGlobalRule(rule: Rule) {
  globalRules.push(rule);
}

export function addGlobalEffect(effect: Effect) {
  globalEffects.push(effect);
}
