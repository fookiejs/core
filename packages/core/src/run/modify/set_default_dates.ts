import { Modify } from "../lifecycle-function.ts"
import { Method } from "../../method/method.ts"

export default Modify.create({
	key: "set_default_dates",
	execute: async function (payload): Promise<void> {
		if (payload.method == Method.CREATE) {
			payload.body.createdAt = new Date().toISOString()
			payload.body.updatedAt = new Date().toISOString()
		} else if (payload.method == Method.UPDATE) {
			payload.body.updatedAt = new Date().toISOString()
		}
	},
})
