import * as lodash from "lodash"

export default async function (payload, state) {
    if (lodash.has(payload.options, "drop")) {
        setTimeout(async function () {
            await ctx.run({
                model: payload.model,
                method: "delete",
                token: payload.token,
                query: {
                    filter: {
                        pk: payload.response.data[payload.model.database.pk],
                    },
                },
            })
        }, payload.options.drop)
    }
}
