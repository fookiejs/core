import { Role } from "../../core/lifecycle-function.ts"
import { Config } from "../../core/config.ts"

export const system = Role.create({
	key: "system",
	execute: async function (payload) {
		return payload.options.token === Config.SYSTEM_TOKEN
	},
}) as Role
