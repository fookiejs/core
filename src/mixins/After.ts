import { db_disconnect } from "./effects"
import { simplified } from "./filters"
import { valid_query } from "./rules"
import { reactive_prepare } from "./effects"
import { filter_fields } from "../src/rules"
import { has_model } from "../src/rules"
import { has_method } from "../src/rules"
import { valid_attributes } from "../src/rules"
import { has_entity } from "../src/rules"
import { check_required } from "../src/rules"
import { can_write } from "../src/rules"
import { need_method_in_options } from "../src/rules"
import { cascade_prepare } from "../src/rules"
import { reactive_delete } from "../src/rules"
import { cascade_delete } from "../src/rules"
import { pk } from "../src/rules"
import { reactives } from "../src/rules"
import { drop } from "../src/rules"

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
            preRule: [has_model, has_method, valid_attributes],
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
