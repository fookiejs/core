import { Method } from "../../method/method.ts"
import { Role } from "../../run/lifecycle-function.ts"

export const writeOnly = Role.create({
	key: "write_only",
	execute: async function (payload) {
		return payload.method === Method.CREATE
	},
})
