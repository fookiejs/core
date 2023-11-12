import { LifecycleFunction } from "../../../../types"

const db_connect: LifecycleFunction<unknown, any> = async function (payload) {
    return await payload.model.database.connect()
}

export default db_connect
