import * as lodash from "lodash"
import { BindsType, BindsTypeField, ModelTypeInput, ModelTypeOutput } from "../model"
import { methods } from "../../method"
import { system } from "../../../defaults/role/system"
import { lifecycles } from "../../lifecycle"

export function fillModel(model: ModelTypeInput): ModelTypeOutput {
    model.binds = lodash.isObject(model.binds) ? model.binds : ({} as BindsType)
    model.mixins = lodash.isArray(model.mixins) ? model.mixins : []

    const defaultBinds: BindsTypeField = {
        modify: [],
        role: [system],
        rule: [],
        filter: [],
        effect: [],
        accepts: [],
        rejects: [],
    }

    for (const method of methods) {
        model.binds[method] = lodash.isObject(model.binds[method])
            ? model.binds[method]
            : { ...defaultBinds }

        model.binds[method] = {
            ...defaultBinds,
            ...model.binds[method],
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
