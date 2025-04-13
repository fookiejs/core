import { Role } from "../../lifecycle-function/lifecycle-function.ts"

export const nobody = Role.create({
	key: "nobody",
	execute: async () => false,
}) as Role
