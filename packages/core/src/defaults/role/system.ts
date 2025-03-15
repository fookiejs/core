import { Role } from "../../core/lifecycle-function"
import { Config } from "../../core/config"

export const system = Role.new({
    key: "system",
    execute: async function (payload) {
        return payload.options.sub === Config.SYSTEM_TOKEN
    },
})
