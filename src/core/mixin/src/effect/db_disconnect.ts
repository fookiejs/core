import { LifecycleFunction } from "../../../lifecycle-function"

export default LifecycleFunction.new({
    key: "db_disconnect",
    execute: async function (payload) {
        await payload.model.database.disconnect()
    },
})
