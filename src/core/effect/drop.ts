import { lifecycle } from "../.."

export default async function (payload, state) {
    if (ctx.lodash.has(payload.options, "drop")) {
        setTimeout(async function () {
            await ctx.run({
                model: payload.model,
                method: "delete",
                token: payload.token,
                query: {
                    filter: {
                        pk: payload.response.data[state.database.pk],
                    },
                },
            })
        }, payload.options.drop)
    }
}
