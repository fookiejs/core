import { Config, LifecycleFunction } from "../../exports"

export const system = LifecycleFunction.new({
    key: "system",
    execute: async function (payload) {
        return payload.options.token === Config.get("SYSTEM_TOKEN")
    },
})
