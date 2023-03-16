module.exports = {
    name: "metric",
    wait: true,
    function: async function (payload, ctx, state) {
        state.metrics.end = Date.now()
        state.metrics.response = state.metrics.end - state.metrics.start
    },
}
