import * as lodash from "lodash"
import { BindsType, ModelTypeInput, ModelTypeOutput } from "../model"
import { methods } from "../../method"
import { system } from "../../../defaults/role/system"
import { lifecycles } from "../../lifecycle"

export function fillModel(model: ModelTypeInput): ModelTypeOutput {
    model.binds = lodash.isObject(model.binds) ? model.binds : ({} as BindsType)
    model.mixins = lodash.isArray(model.mixins) ? model.mixins : []

    for (const method of methods) {
        if (!lodash.isObject(model.binds[method])) {
            model.binds[method] = {
                modify: [],
                role: [system],
                rule: [],
                filter: [],
                effect: [],
                accept: {},
                reject: {},
            }
        }
        for (const lifecycle of lifecycles) {
            if (!lodash.isArray(model.binds[method][lifecycle])) {
                model.binds[method][lifecycle] = []
            }
        }
    }

    if (model.mixins.length > 0) {
        for (const mixin of model.mixins) {
            if (lodash.isObject(mixin)) {
                for (const method of methods) {
                    if (lodash.isObject(mixin.binds[method])) {
                        model.binds[method] = lodash.mergeWith(
                            model.binds[method],
                            mixin.binds[method],
                            (objValue, srcValue) => {
                                if (lodash.isArray(objValue)) {
                                    return objValue.concat(objValue, srcValue)
                                } else {
                                    return objValue
                                }
                            },
                        )
                    }
                }
            }
        }
    }

    return model as ModelTypeOutput
}
