import * as lodash from "lodash"

const selection: LifecycleFunction = async function (payload, state) {
    let model = payload.model
    let fields = lodash.keys(model.schema)
    for (let field of fields) {
        if (typeof model.schema[field].selection === "function" && !payload.body[field]) {
            let res = await model.schema[field].selection(model.schema[field].relation)
            if (res) {
                payload.body[field] = res[payload.model.database.pk]
            }
        }
    }
}

export default selection
