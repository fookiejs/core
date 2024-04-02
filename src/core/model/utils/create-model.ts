import * as lodash from "lodash";
import { BindsType, ModelType } from "../model";
import { Method, methods } from "../../method";
import { system } from "../../../defaults/role/system";
import { lifecycles } from "../../lifecycle";

export function fillModel(model: Partial<ModelType>): ModelType {
    model.binds = lodash.isObject(model.binds) ? model.binds : ({} as BindsType);

    for (const method of methods) {
        if (!lodash.isObject(model.binds[method])) {
            model.binds[method] = {
                preRule: [],
                modify: [],
                role: [system],
                rule: [],
                filter: [],
                effect: [],
                accept: {},
                reject: {},
            };
        }
        for (const lifecycle of lifecycles) {
            //@ts-ignore
            if (!lodash.isArray(model.binds[method][lifecycle])) {
                //@ts-ignore
                model.binds[method][lifecycle] = [];
            }
        }
    }

    return model as ModelType;
}
