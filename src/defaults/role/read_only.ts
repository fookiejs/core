import { Role } from "../../core/lifecycle"
import { Methods } from "../../core/method"

export const readOnly = Role.new({
    key: "read_only",
    execute: async function (payload) {
        return payload.method === Methods.READ
    },
})
