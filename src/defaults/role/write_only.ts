import { Role } from "../../core/lifecycle"
import { Methods } from "../../core/method"

export const writeOnly = Role.new({
    key: "write_only",
    execute: async function (payload) {
        return payload.method === Methods.CREATE || payload.method === Methods.UPDATE
    },
})
