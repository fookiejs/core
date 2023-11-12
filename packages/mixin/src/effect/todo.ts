import { run } from "../../../run"
import { LifecycleFunction } from "../../../../types"

const todo: LifecycleFunction<unknown, any> = async function (payload, state) {
    for (const payload of state.todo) {
        await run(payload)
    }
}

export default todo
