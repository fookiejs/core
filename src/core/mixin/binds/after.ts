import validate_query from "../rule/validate_query"
import filter_fields from "../modify/filter_fields"
import has_entity from "../rule/has_entity"
import check_required from "../rule/check_required"
import cascade_prepare from "../modify/cascade_prepare"
import todo from "../effect/todo"
import attributes from "../filter/attributes"
import validate_body from "../rule/validate_body"
import { BindsType } from "../../model/model"

export const after: BindsType = {
    create: {
        modify: [filter_fields],
        rule: [has_entity, check_required, validate_body],
        role: [],
        filter: [attributes],
        effect: [],
        accepts: [],
        rejects: [],
    },
    read: {
        modify: [filter_fields],
        rule: [validate_query],
        filter: [attributes],
        effect: [],
        role: [],
        accepts: [],
        rejects: [],
    },
    update: {
        modify: [],
        rule: [has_entity, validate_query, check_required, validate_body],
        filter: [],
        effect: [],
        role: [],
        accepts: [],
        rejects: [],
    },
    delete: {
        modify: [cascade_prepare],
        rule: [validate_query],
        filter: [],
        effect: [todo],
        role: [],
        accepts: [],
        rejects: [],
    },
}
