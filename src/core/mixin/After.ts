import db_disconnect from "../effect/db_disconnect"
import simplified from "../filter/simplified"
import valid_query from "../rule/valid_query"
import reactive_prepare from "../modify/reactive_prepare"
import filter_fields from "../modify/filter_fields"
import has_method from "../rule/has_method"
import valid_attributes from "../rule/valid_attributes"
import has_entity from "../rule/has_entity"
import check_required from "../rule/check_required"
import can_write from "../rule/can_write"
import need_method_in_options from "../rule/need_method_in_options"
import cascade_prepare from "../modify/cascade_prepare"
import reactive_delete from "../effect/reactive_delete"
import cascade_delete from "../effect/cascade_delete"
import pk from "../modify/pk"
import reactives from "../modify/pk"
import drop from "../modify/pk"

export const After: MixinInterface = {
    bind: {
        create: {
            modify: [filter_fields, pk],
            rule: [has_entity, check_required],
            preRule: [can_write],
            filter: [],
            effect: [db_disconnect, drop],
        },
        read: {
            modify: [filter_fields, pk],
            rule: [valid_query],
            preRule: [has_method, valid_attributes],
            filter: [simplified],
            effect: [db_disconnect],
            role: [],
        },
        update: {
            preRule: [can_write],
            modify: [pk],
            rule: [has_entity, valid_query, check_required],
            filter: [],
            effect: [db_disconnect, reactives],
            role: [],
        },
        delete: {
            modify: [pk, reactive_prepare, cascade_prepare],
            rule: [valid_query],
            preRule: [],
            filter: [],
            effect: [db_disconnect, reactive_delete, cascade_delete],
            role: [],
        },
        count: {
            modify: [pk],
            rule: [valid_query],
            preRule: [],
            filter: [],
            effect: [db_disconnect],
            role: [],
        },
        test: {
            preRule: [need_method_in_options],
            modify: [],
            rule: [],
            filter: [],
            effect: [db_disconnect],
            role: [],
        },
    },
}
