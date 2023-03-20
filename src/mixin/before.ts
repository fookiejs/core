import validate_payload from "../rule/validate_payload"
import default_payload from "../modify/default_payload"
import has_method from "../rule/has_method"
import validate_attributes from "../rule/validate_attributes"
import db_connect from "../rule/db_connect"
import set_default from "../modify/set_default"
import selection from "../modify/selection"
import only_client from "../rule/only_client"
import only_server from "../rule/only_server"
import uniqueGroup from "../rule/uniqueGroup"
import unique from "../rule/unique"
import field_control from "../rule/field_control"
import check_type from "../rule/check_type"
import has_field from "../rule/has_field"
import has_body from "../rule/has_body"
import need_method_in_options from "../rule/need_method_in_options"

const before: MixinInterface = {
    bind: {
        read: {
            preRule: [validate_payload, default_payload, has_method, validate_attributes, db_connect],
            modify: [],
            role: [],
            rule: [],
            filter: [],
            effect: [],
        },
        create: {
            preRule: [validate_payload, default_payload, has_method, only_client, only_server, db_connect],
            modify: [set_default, selection],
            role: [],
            rule: [has_body, has_field, check_type, field_control, unique, uniqueGroup],
            filter: [],
            effect: [],
        },
        update: {
            preRule: [validate_payload, default_payload, has_method, has_body, db_connect],
            modify: [],
            role: [],
            rule: [has_body, has_field, check_type, field_control, unique],
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
        test: {
            preRule: [validate_payload, default_payload, has_method, need_method_in_options],
            modify: [],
            role: [],
            rule: [has_field],
            filter: [],
            effect: [],
        },
    },
}

export default before
