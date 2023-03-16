import * as lodash from "lodash"

const lifecycle: LifecycleFunction = async function (payload, state) {
    if (lodash.has(payload.options, "simplified")) {
        const keys = [payload.model.database.pk, ...lodash.keys(payload.model.schema)]
        for (let i in payload.response.data as []) {
            payload.response.data[i] = lodash.mapKeys(payload.response.data[i], function (v, k) {
                return lodash.indexOf(keys, k)
            })
        }
    }
}

export default lifecycle
