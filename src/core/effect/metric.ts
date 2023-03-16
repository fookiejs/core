export default lifecycle(async function (payload, state) {
    state.metrics.end = Date.now()
    state.metrics.response = state.metrics.end - state.metrics.start
})
