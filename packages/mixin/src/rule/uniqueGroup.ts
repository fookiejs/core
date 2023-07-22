import * as lodash from "lodash"
import { run } from "../../../core"
import { Count } from "../../../method"
import { LifecycleFunction } from "../../../../types"

const unique_group: LifecycleFunction = async function (payload) {
    const fields = lodash.keys(payload.body)
    let groups = []
    for (const field of fields) {
        if (payload.model.schema[field].unique_group) {
            groups = lodash.uniq(groups.concat(payload.model.schema[field].unique_group))
        }
    }

    for (const group of groups) {
        const filter = {}
        for (const field of lodash.keys(payload.model.schema)) {
            if (
                payload.model.schema[field].unique_group &&
                payload.model.schema[field].unique_group.includes(group) &&
                payload.body[field]
            ) {
                filter[field] = payload.body[field]
            }
        }

        const res = await run({
            token: process.env.SYSTEM_TOKEN,
            model: payload.model,
            method: Count,
            query: {
                filter,
            },
        })
        return res.data == 0
    }

    return true
}

export default unique_group
