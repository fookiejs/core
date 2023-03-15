module.exports = {
    name: "only_server",
    wait: true,
    function: async function (payload, ctx) {
        let search = ["", null, undefined]
        let model = ctx.local.get("model", payload.model)
        let keys = ctx.lodash.keys(model.schema)
        for (let key of keys) {
            if (model.schema[key].onlyServer == true) {
                if (payload.body[key]) {
                    return false
                }
            }
        }
        return true
    },
}
