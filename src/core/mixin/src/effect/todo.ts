import { LifecycleFunction } from "../../../lifecycle-function";

export default LifecycleFunction.new({
    key: "todo",
    execute: async function (payload) {
        console.log("todo");
    },
});
