import { run } from "../run"
import { Read } from "../method"
import * as lodash from "lodash"
import { SelectionInterface } from "../../types"

export const Random: SelectionInterface = async function (payload, target_model) {
    const res = await run({
        token: payload.token || "",
        model: target_model,
        method: Read,
    })

    return lodash.sample(res.data).id
}
