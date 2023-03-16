import valid_payload from "../rule/valid_payload"
import default_payload from "../modify/default_payload"
import has_model from "../rule/has_model"
import has_method from "../rule/has_method"
import valid_attributes from "../rule/valid_attributes"
import db_connect from "../rule/db_connect"
import default_state from "../modify/default_state"
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
import type { MixinInterface } from "../../declerations"

export const Before: MixinInterface = {
    bind: {
        read: {
            preRule: [valid_payload, default_payload, has_model, has_method, valid_attributes, db_connect],
            modify: [default_state],
            rule: [],
            filter: [],
            effect: [],
            role: [],
        },
        create: {
            preRule: [valid_payload, default_payload, has_model, has_method, only_client, only_server, db_connect],
            modify: [default_state, set_default, selection],
            rule: [has_body, has_field, check_type, field_control, unique, uniqueGroup],
            filter: [],
            effect: [],
            role: [],
        },
        update: {
            preRule: [valid_payload, default_payload, has_model, has_method, has_body, db_connect],
            modify: [default_state],
            rule: [has_body, has_field, check_type, field_control, unique],
            filter: [],
            effect: [],
            role: [],
        },
        delete: {
            preRule: [valid_payload, default_payload, has_model, has_method, db_connect],
            modify: [default_state],
            rule: [],
            filter: [],
            effect: [],
            role: [],
        },
        count: {
            preRule: [valid_payload, default_payload, has_model, has_method, db_connect],
            modify: [default_state],
            rule: [],
            filter: [],
            effect: [],
            role: [],
        },
        test: {
            preRule: [valid_payload, default_payload, has_model, has_method, need_method_in_options],
            modify: [default_state],
            rule: [has_field],
            filter: [],
            effect: [],
            role: [],
        },
    },
}
