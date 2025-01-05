import { Role } from "../../core/lifecycle-function"
import { Method } from "../.."

export const writeOnly = Role.new({
    key: "write_only",
    execute: async function (payload) {
        return payload.method === Method.CREATE
    },
})
