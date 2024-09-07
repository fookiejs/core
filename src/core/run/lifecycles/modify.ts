import { after } from "../../mixin/binds/after"
import { before } from "../../mixin/binds/before"
import { Payload } from "../../payload"
import * as moment from "moment"

const modify = async function (payload: Payload<any>): Promise<void> {
    const modifies = [
        ...before[payload.method].modify,
        ...payload.modelClass.binds()[payload.method].modify,
        ...after[payload.method].modify,
    ]

    for (const modify of modifies) {
        payload.state.metrics.end = moment.utc().toDate()

        const start = Date.now()
        try {
            await modify.execute(payload)
        } catch (error) {}
        payload.state.metrics.lifecycle.push({
            name: modify.key,
            ms: Date.now() - start,
        })
    }
}
export default modify
