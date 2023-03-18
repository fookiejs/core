import * as lodash from "lodash"
import { v4 } from "uuid"
import { models, run } from "../.."
import { Count, Create, Delete, Read, Update } from "../../methods"

const unique_group: LifecycleFunction = async function (payload, ctx) {
    let model = payload.model
    let fields = lodash.keys(payload.body)
    let groups = []
    for (let field of fields) {
        if (model.schema[field].unique_group) {
            groups = lodash.uniq(groups.concat(model.schema[field].unique_group))
        }
    }

    for (const group of groups) {
        let filter = {}
        for (const field of lodash.keys(model.schema)) {
            if (model.schema[field].unique_group && model.schema[field].unique_group.includes(group) && payload.body[field]) {
                filter[field] = payload.body[field]
            }
        }

        const res = await run({
            token: process.env.SYSTEM_TOKEN,
            model: model.name,
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
