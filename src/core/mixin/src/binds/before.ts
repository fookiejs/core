import set_default from "../modify/set_default"
import uniqueGroup from "../rule/uniqueGroup"
import unique from "../rule/unique"
import check_type from "../rule/check_type"
import has_field from "../rule/has_field"
import has_body from "../rule/has_body"
import set_id from "../modify/set-id"
import { BindsType } from "../../../model/model"

export const before: BindsType = {
    create: {
        modify: [set_id, set_default],
        role: [],
        rule: [has_body, has_field, check_type, unique, uniqueGroup],
        filter: [],
        effect: [],
        accept: {},
        reject: {},
    },
    read: {
        modify: [],
        role: [],
        rule: [],
        filter: [],
        effect: [],
        accept: {},
        reject: {},
    },
    update: {
        modify: [],
        role: [],
        rule: [has_body, has_field, check_type, unique],
        filter: [],
        effect: [],
        accept: {},
        reject: {},
    },
    delete: {
        modify: [],
        role: [],
        rule: [],
        filter: [],
        effect: [],
        accept: {},
        reject: {},
    },
    count: {
        modify: [],
        role: [],
        rule: [],
        filter: [],
        effect: [],
        accept: {},
        reject: {},
    },
    sum: {
        modify: [],
        role: [],
        rule: [has_field],
        filter: [],
        effect: [],
        accept: {},
        reject: {},
    },
}
