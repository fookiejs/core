import { Modify } from "../../lifecycle-function.ts"
import { Method } from "../../method.ts"

export default Modify.create({
	key: "set_dates",
	execute: async function (payload) {
		if (payload.method === Method.CREATE) {
			payload.body.createdAt = new Date().toISOString()
			payload.body.updatedAt = new Date().toISOString()
			payload.body.deletedAt = null
		}
		if (payload.method === Method.UPDATE) {
			payload.body.updatedAt = new Date().toISOString()
		}
		if (payload.method === Method.DELETE) {
			payload.body.deletedAt = new Date().toISOString()
		}
	},
})
