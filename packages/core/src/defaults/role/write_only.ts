import { Method } from "../../core/method.ts"
import { Role } from "../../core/lifecycle-function.ts"

export const writeOnly = Role.create({
	key: "write_only",
	execute: async function (payload) {
		return payload.method === Method.CREATE
	},
})
