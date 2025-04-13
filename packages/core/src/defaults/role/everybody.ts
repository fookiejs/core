import { Role } from "../../lifecycle-function/lifecycle-function.ts"

export const everybody = Role.create({
	key: "everybody",
	execute: async () => true,
}) as Role
