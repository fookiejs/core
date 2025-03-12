import { Role } from "../../core/lifecycle-function"

export const everybody = Role.new({
    key: "everybody",
    execute: async () => true,
})
