export default async function (payload, state) {
    const filters = payload.model.bind[payload.method].filter
    for (const filter of filters) {
        const start = Date.now()
        await filter(payload, state)
        state.metrics.lifecycle.push({
            name: filter.name,
            ms: Date.now() - start,
        })
    }
}
