import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const pk: LifecycleFunction<unknown, any> = async function (payload) {
    if (lodash.has(payload.query.filter, "pk")) {
        payload.query.filter = lodash.assign(payload.query.filter, {
            [payload.model.database.pk]: payload.query.filter.pk,
        })
        payload.query.filter = lodash.omit(payload.query.filter, ["pk"])
    }
}

export default pk
