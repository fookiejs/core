import { LifecycleFunction } from "../../exports.ts";

export const nobody = LifecycleFunction.new({
    key: "nobody",
    execute: () => false,
});
