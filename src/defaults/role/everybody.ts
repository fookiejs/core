import { Role } from "../../core/lifecycle"

export const everybody = Role.new({
    key: "everybody",
    execute: async function () {
        return true
    },
})
