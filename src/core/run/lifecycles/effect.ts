import { after } from "../../mixin/src/binds/after"
import { before } from "../../mixin/src/binds/before"
import { Payload } from "../../payload"

const effect = async function (payload: Payload<any>, response: any): Promise<void> {
    const effects = [
        ...before[payload.method].effect,
        ...payload.model.binds[payload.method].effect,
        ...after[payload.method].effect,
    ]

    const promises = effects.map(async (effect) => {
        const start = Date.now()
        await effect.execute(payload, response)

        payload.state.metrics.lifecycle.push({
            name: effect.key,
            ms: Date.now() - start,
        })
    })

    await Promise.all(promises)
}

export default effect
