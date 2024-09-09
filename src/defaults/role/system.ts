import { Role } from "../../core/lifecycle-function"
import { Config } from "../../core/config"

export const system = Role.new({
    key: "system",
    execute: async function (payload) {
        return payload.options.token === Config.SYSTEM_TOKEN
    },
})
