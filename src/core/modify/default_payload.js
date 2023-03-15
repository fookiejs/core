module.exports = {
    name: "default_payload",
    wait: true,
    function: async function (payload, ctx, state) {
        const model = ctx.local.get("model", payload.model)
        const newPayload = ctx.lodash.merge(payload, {
            options: {},
            body: {},
            query: {
                attributes: [],
            },
            id: ctx.helpers.uuid.v4().replace("-", ""),
        })

        for (let key in newPayload) {
            payload[key] = newPayload[key]
        }

        state.metrics = {
            lifecycle: [],
            response: 0,
            start: Date.now(),
        }
        if (!payload.query.offset) {
            payload.query.offset = 0
        }
        if (!payload.query.limit) {
            payload.query.limit = 0
        }
        if (payload.query.attributes.length == 0) {
            payload.query.attributes = ctx.lodash.keys(model.schema) //TODO eğer model yoksa patlıyor.
        }
    },
}
