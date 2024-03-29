import db_disconnect from "../effect/db_disconnect"
import validate_query from "../rule/validate_query"
import reactive_prepare from "../modify/reactive_prepare"
import filter_fields from "../modify/filter_fields"
import has_method from "../rule/has_method"
import validate_attributes from "../rule/validate_attributes"
import has_entity from "../rule/has_entity"
import check_required from "../rule/check_required"
import can_write from "../rule/can_write"
import need_method_in_options from "../rule/need_method_in_options"
import cascade_prepare from "../modify/cascade_prepare"
import todo from "../effect/todo"
import pk from "../modify/pk"
import reactives from "../effect/reactives"
import drop from "../effect/drop"
import { MixinInterface } from "../../../../types"
import need_field_in_options from "../rule/need_field_in_options"
import validate_body from "../rule/validate_body"

const after: MixinInterface = {
    bind: {
        create: {
            modify: [filter_fields, pk],
            rule: [has_entity, check_required, validate_body],
            pre_rule: [can_write],
            role: [],
            filter: [],
            effect: [db_disconnect, drop],
        },
        read: {
            modify: [filter_fields, pk],
            rule: [validate_query],
            pre_rule: [has_method, validate_attributes],
            filter: [],
            effect: [db_disconnect],
            role: [],
        },
        update: {
            pre_rule: [can_write],
            modify: [pk],
            rule: [has_entity, validate_query, check_required, validate_body],
            filter: [],
            effect: [db_disconnect, reactives],
            role: [],
        },
        delete: {
            modify: [pk, reactive_prepare, cascade_prepare],
            rule: [validate_query],
            pre_rule: [],
            filter: [],
            effect: [db_disconnect, todo],
            role: [],
        },
        count: {
            modify: [pk],
            rule: [validate_query],
            pre_rule: [],
            filter: [],
            effect: [db_disconnect],
            role: [],
        },
        test: {
            pre_rule: [need_method_in_options],
            modify: [],
            rule: [],
            filter: [],
            effect: [db_disconnect],
            role: [],
        },
        sum: {
            pre_rule: [need_field_in_options],
            modify: [pk],
            rule: [validate_query],
            filter: [],
            role: [],
            effect: [db_disconnect],
        },
    },
}

export { after }
