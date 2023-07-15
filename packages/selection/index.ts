import { run } from "../core"
import { Read } from "../method"
import * as lodash from "lodash"
import { Selection } from "../../types"

export const Random: Selection = async function (payload, target_model) {
    const res = await run({
        token: payload.token || "",
        model: target_model,
        method: Read,
    })

    return lodash.sample(res.data).id
}
