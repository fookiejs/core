import * as lodash from "lodash"

const lifecycle: LifecycleFunction = async function (payload, state) {
    return await payload.model.database.connect()
}

export default lifecycle
