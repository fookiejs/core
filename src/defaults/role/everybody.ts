import { LifecycleFunction } from "../../exports"

export const everybody = LifecycleFunction.new({
    key: "everybody",
    execute: () => true,
})
