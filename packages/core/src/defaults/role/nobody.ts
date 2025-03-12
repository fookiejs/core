import { Role } from "../../core/lifecycle-function"

export const nobody = Role.new({
    key: "nobody",
    execute: async () => false,
})
