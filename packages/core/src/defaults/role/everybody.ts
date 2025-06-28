import { Role } from "../../run/lifecycle-function.ts"
export const everybody = Role.create({
	key: "everybody",
	execute: async () => true,
}) as Role
