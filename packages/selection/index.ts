import { run } from "../core"
import { Read } from "../method"
import * as lodash from "lodash"
import { Selection } from "../../types"

export const Random: Selection = async function (model, field) {
    const res = await run({
        model: field.relation,
        method: Read,
    })

    return lodash.sample(res.data).id
}
