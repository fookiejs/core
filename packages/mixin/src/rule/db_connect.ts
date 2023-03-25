import { LifecycleFunction } from "../../../../types"

const db_connect: LifecycleFunction = async function (payload) {
    return await payload.model.database.connect()
}

export default db_connect
