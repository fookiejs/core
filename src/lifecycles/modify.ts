module.exports = async function (payload: PayloadInterface, state: StateInterface) {
    const modifies = payload.model.bind[payload.method].preRule
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
