import * as lodash from "lodash"
import { v4 } from "uuid"
import { models, run } from "../.."
import { Delete } from "methods"

const filter_fields: LifecycleFunction = async function (payload, state) {
    const model = payload.model
    for (let field of payload.query.attributes) {
        let attr_roles = lodash.has(model.schema[field], "read") ? model.schema[field].read : []
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
