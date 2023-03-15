module.exports = async function (payload: PayloadInterface, state: StateInterface) {
    const preRules = payload.model.bind[payload.method].preRule
    for (let preRule of preRules) {
        const start = Date.now()
        const res = await preRule(payload, state)
        state.metrics.lifecycle.push({
            name: preRule.name,
            ms: Date.now() - start,
        })

        if (res === false) {
            payload.response.error = preRule.name
            return false
        }
    }
    return true
}
