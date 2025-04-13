import { v4 } from "uuid"
import { Modify } from "../../lifecycle-function/lifecycle-function.ts"

export default Modify.create({
	key: "set_id",
	execute: async function (payload) {
		payload.body.id = v4()
	},
})
