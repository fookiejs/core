import { LifecycleFunction } from "../../exports"

export const nobody = LifecycleFunction.new({
    key: "nobody",
    execute: () => false,
})
