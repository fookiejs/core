import * as lodash from "lodash"
import { Rule } from "../../../lifecycle-function"

export default Rule.new({
    key: "has_body",
    execute: async function (payload) {
        return lodash.has(payload, "body")
    },
})
