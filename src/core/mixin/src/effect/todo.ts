import { Effect } from "../../../lifecycle-function"

export default Effect.new({
    key: "todo",
    execute: async function (payload) {
        for (const fn of payload.state.todo) {
            await fn()
        }
    },
})
