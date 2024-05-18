import { LifecycleFunction } from "../../../lifecycle-function"

export default LifecycleFunction.new({
    key: "db_connect",
    execute: async function (payload) {
        return await payload.model.database.connect()
    },
})
