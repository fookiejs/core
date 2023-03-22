import { run } from "../core"
import { Read } from "../method"
import * as lodash from "lodash"
import { Selection } from "../../types"

export const Random: Selection = async function (model, field) {
    let res = await run({
        model: field.relation,
        method: Read,
    })

    const r = lodash.sample(res.data).id

    return r
}
