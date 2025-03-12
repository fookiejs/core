import { Role } from "../../core/lifecycle-function"
import { Method } from "@fookiejs/core"

export const readOnly = Role.new({
    key: "read_only",
    execute: async function (payload) {
        return payload.method === Method.READ
    },
})
