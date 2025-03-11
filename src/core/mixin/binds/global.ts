import { Effect, Rule } from "../../lifecycle-function"
import { Method } from "../../method"
import { Model } from "../../model/model"
import db_disconnect from "../effect/db_disconnect"
import default_payload from "../modify/default_payload"
import can_write from "../rule/can_write"
import db_connect from "../rule/db_connect"
import has_body from "../rule/has_body"
import has_method from "../rule/has_method"
import validate_attributes from "../rule/validate_attributes"
import validate_payload from "../rule/validate_payload"

export const globalRules: Rule<Model, Method>[] = [
    validate_payload,
    default_payload,
    validate_payload,
    has_method,
    has_body,
    validate_attributes,
    db_connect,
    can_write,
] as const

export const globalEffects: Effect<Model, Method>[] = [db_disconnect] as const

export function addGlobalRule(rule: Rule) {
    globalRules.push(rule)
}

export function addGlobalEffect(effect: Effect) {
    globalEffects.push(effect)
}
