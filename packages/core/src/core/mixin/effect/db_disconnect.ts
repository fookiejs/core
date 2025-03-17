import { Effect } from "../../lifecycle-function.ts"

export default Effect.create({
	key: "db_disconnect",
	execute: async function (payload) {
		await payload.model.database().disconnect()
	},
})
