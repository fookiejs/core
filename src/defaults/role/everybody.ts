import { Role } from "../../exports"

export const everybody = Role.new({
    key: "everybody",
    execute: () => true,
})
