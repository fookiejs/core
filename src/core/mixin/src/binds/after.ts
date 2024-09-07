import db_disconnect from "../effect/db_disconnect"
import validate_query from "../rule/validate_query"
import filter_fields from "../modify/filter_fields"
import has_entity from "../rule/has_entity"
import check_required from "../rule/check_required"
import cascade_prepare from "../modify/cascade_prepare"
import todo from "../effect/todo"
import drop from "../effect/drop"
import attributes from "../filter/attributes"
import validate_body from "../rule/validate_body"
import { BindsType } from "../../../model/model"

export const after: BindsType = {
    create: {
        modify: [filter_fields],
        rule: [has_entity, check_required, validate_body],
        role: [],
        filter: [attributes],
        effect: [db_disconnect, drop],
        accept: {},
        reject: {},
    },
    read: {
        modify: [filter_fields],
        rule: [validate_query],
        filter: [attributes],
        effect: [db_disconnect],
        role: [],
        accept: {},
        reject: {},
    },
    update: {
        modify: [],
        rule: [has_entity, validate_query, check_required, validate_body],
        filter: [],
        effect: [db_disconnect],
        role: [],
        accept: {},
        reject: {},
    },
    delete: {
        modify: [cascade_prepare],
        rule: [validate_query],
        filter: [],
        effect: [db_disconnect, todo],
        role: [],
        accept: {},
        reject: {},
    },
    count: {
        modify: [],
        rule: [validate_query],
        filter: [],
        effect: [db_disconnect],
        role: [],
        accept: {},
        reject: {},
    },
    sum: {
        modify: [],
        rule: [validate_query],
        filter: [],
        role: [],
        effect: [db_disconnect],
        accept: {},
        reject: {},
    },
}
