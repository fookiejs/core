export default async function (payload: PayloadInterface, state: StateInterface) {
    const rules = payload.model.bind[payload.method].rule
    for (const rule of rules) {
        const start = Date.now()
        const res = await rule(payload, state)
        state.metrics.lifecycle.push({
            name: rule.name,
            ms: Date.now() - start,
        })

        if (res === false) {
            payload.response.error = rule.name
            return false
        }
    }
    return true
}
