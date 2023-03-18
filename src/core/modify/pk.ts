import * as lodash from "lodash"
import { v4 } from "uuid"
import { models, run } from "../.."
import { Delete } from "methods"

const pk: LifecycleFunction = async function (payload, state) {
    let model = payload.model
    let database = model.database
    if (lodash.has(payload.query.filter, "pk")) {
        payload.query.filter = lodash.assign(payload.query.filter, {
            [database.pk]: payload.query.filter.pk,
        })
        payload.query.filter = lodash.omit(payload.query.filter, ["pk"])
    }
}

export default pk
