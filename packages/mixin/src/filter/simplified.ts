import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const simplified: LifecycleFunction<unknown, any> = async function (payload) {
    if (lodash.has(payload.options, "simplified")) {
        const keys = [payload.model.database.pk, ...lodash.keys(payload.model.schema)]
        for (const i in payload.response.data as []) {
            payload.response.data[i] = lodash.mapKeys(payload.response.data[i], function (v, k) {
                return lodash.indexOf(keys, k)
            })
        }
    }
}

export default simplified
