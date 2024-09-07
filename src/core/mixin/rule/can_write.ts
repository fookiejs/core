import * as lodash from "lodash"
import { Rule } from "../../lifecycle-function"
import { Method } from "../../method"

export default Rule.new({
    key: "can_write",
    execute: async function (payload, error) {
        if (!(payload.method === Method.CREATE || payload.method === Method.UPDATE)) {
            return true
        }
        const filtered_schema = lodash.pick(payload.schema, lodash.keys(payload.body))

        const writes = lodash.map(filtered_schema, function (i) {
            return i?.write
        })

        const filtered_writes = lodash.difference(writes, [undefined, null])
        const roles = lodash.flatten(filtered_writes)

        for (const role of roles) {
            if (role) {
                const res = await role.execute(payload, error)
                if (!res) {
                    return false
                }
            }
        }

        return true
    },
})
