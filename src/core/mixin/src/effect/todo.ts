import { LifecycleFunction } from "../../../lifecycle-function";

export default LifecycleFunction.new({
    key: "todo",
    execute: async function (payload) {
        for (const fn of payload.state.todo) {
            await fn();
        }
    },
});
