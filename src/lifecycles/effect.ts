export default async function (payload: PayloadInterface, state: StateInterface) {
    const effects = payload.model.bind[payload.method].effect
    for (const effect of effects) {
        let start = Date.now()
        await effect(payload, state)

        state.metrics.lifecycle.push({
            name: effect.name,
            ms: Date.now() - start,
        })
    }
}
