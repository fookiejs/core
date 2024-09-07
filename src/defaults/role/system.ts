import { Config, Role } from "../../exports"

export const system = Role.new({
    key: "system",
    execute: async function (payload) {
        return payload.options.token === Config.get("SYSTEM_TOKEN")
    },
})
