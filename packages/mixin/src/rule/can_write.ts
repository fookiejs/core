import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const can_write: LifecycleFunction<unknown, any> = async function (payload, state) {
    const model = payload.model
    const filtered_schema = lodash.pick(model.schema, lodash.keys(payload.body))
    const writes = lodash.map(filtered_schema, function (i) {
        return i["write"]
    })
    const filtered_writes = lodash.difference(writes, [undefined, null])
    const roles = lodash.flatten(filtered_writes)

    for (const role of roles) {
        const res = await role(payload, state)
        if (!res) {
            return false
        }
    }

    return true
}

export default can_write
