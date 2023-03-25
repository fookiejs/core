import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const filter_fields: LifecycleFunction = async function (payload, state) {
    const model = payload.model
    for (const field of payload.query.attributes) {
        const attr_roles = lodash.has(model.schema[field], "read") ? model.schema[field].read : []
        let show = true
        for (const role of attr_roles) {
            const res = await role(payload, state)
            show = show && !!res
        }
        if (!show) {
            payload.query.attributes = lodash.pull(payload.query.attributes, field)
        }
    }
}

export default filter_fields
