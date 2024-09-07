import { Role } from "../../exports"

export const nobody = Role.new({
    key: "nobody",
    execute: () => false,
})
