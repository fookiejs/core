import * as lodash from "lodash"
import { MixinInterface } from "../../../../types"
export const methods = ["create", "read", "update", "delete", "count", "test"]
export const lifecycles = ["preRule", "modify", "role", "rule", "filter", "effect"]

export function mixin(mixin: MixinInterface) {
    if (!lodash.isObject(mixin.bind)) {
        mixin.bind = {}
    }
    if (!lodash.isObject(mixin.schema)) {
        mixin.schema = {}
    }
    for (const method of methods) {
        if (!lodash.isObject(mixin.bind[method])) {
            mixin.bind[method] = {}
        }
        for (const lifecycle of lifecycles) {
            if (!lodash.isArray(mixin.bind[method][lifecycle])) {
                mixin.bind[method][lifecycle] = []
            }
        }
    }

    return mixin
}
