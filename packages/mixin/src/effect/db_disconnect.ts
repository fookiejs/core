import { LifecycleFunction, Method } from "../../../../types"

const db_disconnect: LifecycleFunction<unknown, Method> = async function db_disconnect(payload) {
    await payload.model.database.disconnect()
}

export default db_disconnect
