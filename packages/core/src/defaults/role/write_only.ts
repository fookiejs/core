import { Method, Role } from "@fookiejs/core"

export const writeOnly = Role.new({
    key: "write_only",
    execute: async function (payload) {
        return payload.method === Method.CREATE
    },
})
