import { Effect } from "../../lifecycle-function"

export default Effect.new({
    key: "db_disconnect",
    execute: async function (payload) {
        await payload.modelClass.database().disconnect()
    },
})
