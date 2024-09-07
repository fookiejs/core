import * as lodash from "lodash"
import { Rule } from "../../../lifecycle-function"
import { methods } from "../../../method"

export default Rule.new({
    key: "has_method",
    execute: async function (payload) {
        return lodash.includes(methods, payload.method)
    },
})
