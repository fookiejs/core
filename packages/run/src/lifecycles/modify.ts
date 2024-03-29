import { LifecycleFunction, Method } from "../../../../types"
import * as Mixin from "../../../mixin"

const modify: LifecycleFunction<unknown, Method> = async function (payload, state) {
    const befores = Mixin.before.bind[payload.method].modify
    const afters = Mixin.after.bind[payload.method].modify
    const modifies = [...befores, ...payload.model.bind[payload.method].modify, ...afters]

    for (const modify of modifies) {
        const start = Date.now()
        try {
            await modify(payload, state)
        } catch (error) {
            console.log(error)
        }
        state.metrics.lifecycle.push({
            name: modify.name,
            ms: Date.now() - start,
        })
    }
}
export default modify
