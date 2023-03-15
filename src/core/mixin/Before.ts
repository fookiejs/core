import { valid_payload } from "../src/rules"
import { default_payload } from "../src/rules"
import { has_model } from "../src/rules"
import { has_method } from "../src/rules"
import { valid_attributes } from "../src/rules"
import { db_connect } from "../src/rules"
import { default_state } from "../src/rules"
import { set_default } from "../src/rules"
import { selection } from "../src/rules"
import { only_client } from "../src/rules"
import { only_server } from "../src/rules"
import { uniqueGroup } from "../src/rules"
import { unique } from "../src/rules"
import { field_control } from "../src/rules"
import { check_type } from "../src/rules"
import { has_field } from "../src/rules"
import { has_body } from "../src/rules"
import { need_method_in_options } from "../src/rules"

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
