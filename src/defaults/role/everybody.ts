import { LifecycleFunction } from "../../exports.ts";

export const everybody = LifecycleFunction.new({
    key: "everybody",
    execute: () => true,
});
