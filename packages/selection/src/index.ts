import { run } from "@fookie/core"
import { Read } from "@fookie/method"
import * as lodash from "lodash"
import { Selection } from "./interfaces"

export const Random: Selection = async function (model, field) {
    let res = await run({
        model: field.relation,
        method: Read,
    })

    const r = lodash.sample(res.data).id

    return r
}

export * from "./interfaces"
