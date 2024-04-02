import db_disconnect from "../effect/db_disconnect";
import validate_query from "../rule/validate_query";
import reactive_prepare from "../modify/reactive_prepare";
import filter_fields from "../modify/filter_fields";
import has_method from "../rule/has_method";
import validate_attributes from "../rule/validate_attributes";
import has_entity from "../rule/has_entity";
import check_required from "../rule/check_required";
import can_write from "../rule/can_write";
import cascade_prepare from "../modify/cascade_prepare";
import todo from "../effect/todo";
import reactives from "../effect/reactives";
import drop from "../effect/drop";
import need_field_in_options from "../rule/need_field_in_options";
import validate_body from "../rule/validate_body";
import { BindsType } from "../../../model/model";

export const after: BindsType = {
    create: {
        modify: [filter_fields],
        rule: [has_entity, check_required, validate_body],
        preRule: [can_write],
        role: [],
        filter: [],
        effect: [db_disconnect, drop],
    },
    read: {
        modify: [filter_fields],
        rule: [validate_query],
        preRule: [has_method, validate_attributes],
        filter: [],
        effect: [db_disconnect],
        role: [],
    },
    update: {
        preRule: [can_write],
        modify: [],
        rule: [has_entity, validate_query, check_required, validate_body],
        filter: [],
        effect: [db_disconnect, reactives],
        role: [],
    },
    delete: {
        modify: [reactive_prepare, cascade_prepare],
        rule: [validate_query],
        preRule: [],
        filter: [],
        effect: [db_disconnect, todo],
        role: [],
    },
    count: {
        modify: [],
        rule: [validate_query],
        preRule: [],
        filter: [],
        effect: [db_disconnect],
        role: [],
    },
    sum: {
        preRule: [need_field_in_options],
        modify: [],
        rule: [validate_query],
        filter: [],
        role: [],
        effect: [db_disconnect],
    },
};
