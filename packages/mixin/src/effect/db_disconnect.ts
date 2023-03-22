import { LifecycleFunction } from "../../../../types"

const db_disconnect: LifecycleFunction = async function db_disconnect(payload, state) {
    await payload.model.database.disconnect()
}

export default db_disconnect
