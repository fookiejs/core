import { Role } from "../../core/lifecycle-function"
import { Method } from "../.."

export const readOnly = Role.new({
    key: "read_only",
    execute: async function (payload) {
        return (
            payload.method === Method.READ ||
            payload.method === Method.SUM ||
            payload.method === Method.COUNT
        )
    },
})
