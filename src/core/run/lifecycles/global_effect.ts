import { globalEffects } from "../../mixin"
import { Payload } from "../../payload"
import * as lodash from "lodash"

const globalEffect = async function (payload: Payload<any>, response?: any): Promise<void> {
    setImmediate(async () => {
        for (const effect of lodash.reverse(globalEffects)) {
            const start = Date.now()
            await effect.execute(payload, response)

            payload.state.metrics.lifecycle.push({
                name: effect.key,
                ms: Date.now() - start,
            })
        }
    })
}

export default globalEffect
