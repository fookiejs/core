import * as lodash from "lodash"

const db_connect: LifecycleFunction = async function (payload, state) {
    return await payload.model.database.connect()
}

export default db_connect
