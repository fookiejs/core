import { PreRule } from "../../lifecycle-function"

export default PreRule.new({
    key: "db_connect",
    execute: async function (payload) {
        await payload.model.database.connect()
        return true
    },
})
