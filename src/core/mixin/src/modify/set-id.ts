import { v4 } from "uuid"
import { Modify } from "../../../lifecycle-function"

export default Modify.new({
    key: "set_id",
    execute: async function (payload) {
        payload.body.id = v4()
    },
})
