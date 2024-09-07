import { Effect, PreRule } from "../../../lifecycle-function"
import db_disconnect from "../effect/db_disconnect"
import default_payload from "../modify/default_payload"
import can_write from "../rule/can_write"
import db_connect from "../rule/db_connect"
import has_body from "../rule/has_body"
import has_method from "../rule/has_method"
import need_field_in_options from "../rule/need_field_in_options"
import validate_attributes from "../rule/validate_attributes"
import validate_payload from "../rule/validate_payload"

export const preRules: PreRule<any>[] = [
    validate_payload,
    default_payload,
    validate_payload,
    has_method,
    has_body,
    validate_attributes,
    need_field_in_options,
    db_connect,
    can_write,
] as const

export const globalEffects: Effect<any>[] = [db_disconnect] as const

export function addPreRule(preRule) {
    preRules.push(preRule)
}

export function addGlobalEffect(preRule) {
    globalEffects.push(preRule)
}
