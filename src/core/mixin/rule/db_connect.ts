import { Rule } from "../../lifecycle-function"

export default Rule.new({
    key: "db_connect",
    execute: async function (payload) {
        await payload.modelClass.database().connect()
        return true
    },
})
