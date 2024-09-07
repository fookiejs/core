import { PreRule } from "../../lifecycle-function"

export default PreRule.new({
    key: "db_connect",
    execute: async function (payload) {
        await payload.modelClass.database().connect()
        return true
    },
})
