import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const validate_attributes: LifecycleFunction<unknown, any> = async function (payload) {
    const keys = lodash.keys(payload.model.schema).concat([payload.model.database.pk])
    return payload.query.attributes.every(function (k) {
        return keys.includes(k)
    })
}

export default validate_attributes
