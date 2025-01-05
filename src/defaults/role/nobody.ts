import { Role } from "../../core/lifecycle"

export const nobody = Role.new({
    key: "nobody",
    execute: async () => false,
})
