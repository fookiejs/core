import { Role } from "../../lifecycle-function/lifecycle-function.ts"
import { Method } from "../../method/method.ts"

export const readOnly = Role.create({
	key: "read_only",
	execute: async function (payload) {
		return payload.method === Method.READ
	},
})
