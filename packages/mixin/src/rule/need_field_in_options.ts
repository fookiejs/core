import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const need_field_in_options: LifecycleFunction = async function (payload) {
    return (
        lodash.has(payload.options, "field") &&
        typeof payload.options.field == "string" &&
        lodash.keys(payload.model.schema).concat(payload.model.database.pk).includes(payload.options.field)
    )
}

export default need_field_in_options
