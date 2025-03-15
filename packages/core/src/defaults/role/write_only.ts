import { Method } from "../../core/method"
import { Role } from "../../core/lifecycle-function"

export const writeOnly = Role.new({
    key: "write_only",
    execute: async function (payload) {
        return payload.method === Method.CREATE
    },
})
