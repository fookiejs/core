export default async function (payload, state) {
    let start = Date.now()

    if (lodash.isUndefined(payload.response.data)) {
        await payload.model.methods[payload.method](payload, state)
    }
    state.metrics.lifecycle.push({
        name: "method",
        time: Date.now() - start,
    })
}
