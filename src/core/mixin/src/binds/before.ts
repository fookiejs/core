import validate_payload from "../rule/validate_payload"
import default_payload from "../modify/default_payload"
import has_method from "../rule/has_method"
import validate_attributes from "../rule/validate_attributes"
import db_connect from "../rule/db_connect"
import set_default from "../modify/set_default"
import uniqueGroup from "../rule/uniqueGroup"
import unique from "../rule/unique"
import check_type from "../rule/check_type"
import has_field from "../rule/has_field"
import has_body from "../rule/has_body"
import set_id from "../modify/set-id"
import need_field_in_options from "../rule/need_field_in_options"
import { BindsType } from "../../../model/model"

export const before: BindsType = {
    create: {
        preRule: [validate_payload, default_payload, has_method, db_connect],
        modify: [set_id, set_default],
        role: [],
        rule: [has_body, has_field, check_type, unique, uniqueGroup],
        filter: [],
        effect: [],
    },
    read: {
        preRule: [validate_payload, default_payload, has_method, validate_attributes, db_connect],
        modify: [],
        role: [],
        rule: [],
        filter: [],
        effect: [],
    },
    update: {
        preRule: [validate_payload, default_payload, has_method, has_body, db_connect],
        modify: [],
        role: [],
        rule: [has_body, has_field, check_type, unique],
        filter: [],
        effect: [],
    },
    delete: {
        preRule: [validate_payload, default_payload, has_method, db_connect],
        modify: [],
        role: [],
        rule: [],
        filter: [],
        effect: [],
    },
    count: {
        preRule: [validate_payload, default_payload, has_method, db_connect],
        modify: [],
        role: [],
        rule: [],
        filter: [],
        effect: [],
    },
    sum: {
        preRule: [validate_payload, default_payload, has_method, need_field_in_options],
        modify: [],
        role: [],
        rule: [has_field],
        filter: [],
        effect: [],
    },
}
