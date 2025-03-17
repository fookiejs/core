import { Role } from "../../core/lifecycle-function.ts"

export const everybody = Role.create({
	key: "everybody",
	execute: async () => true,
})
