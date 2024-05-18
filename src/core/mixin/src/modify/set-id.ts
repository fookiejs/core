import { v4 } from "uuid"
import { LifecycleFunction } from "../../../lifecycle-function"

export default LifecycleFunction.new({
    key: "set_id",
    execute: async function (payload) {
        payload.body.id = v4()
    },
})
