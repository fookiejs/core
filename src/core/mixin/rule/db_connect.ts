import { Rule } from "../../lifecycle-function"

export default Rule.new({
    key: "db_connect",
    execute: async function (payload) {
        await payload.model.database().connect()
        return true
    },
})
