import * as lodash from "lodash"
import { Rule } from "../../lifecycle-function"
import { Model } from "../../model/model"
import { Method } from "../../method"

export default Rule.new<Model, Method>({
    key: "check_type",
    execute: async function (payload) {
        for (const field in payload.body) {
            const type = payload.model.schema()[field].type

            if (!lodash.isNull(payload.body[field]) && !type.validate(payload.body[field])) {
                return false
            }
        }
        return true
    },
})
