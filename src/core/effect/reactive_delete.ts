import * as lodash from "lodash"

export default async function (payload, state) {
    for (const { model, pk } of state.reactive_delete_list) {
        await ctx.remote.delete(model, pk)
    }
}
