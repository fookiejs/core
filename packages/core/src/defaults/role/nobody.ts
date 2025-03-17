import { Role } from "../../core/lifecycle-function.ts"

export const nobody = Role.create({
	key: "nobody",
	execute: async () => false,
})
