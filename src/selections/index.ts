import { run } from ".."
import { Read } from "../methods"
import * as lodash from "lodash"
export const Random = async function (model: ModelInterface, field: FieldInterface) {
    let res = await run({
        model: field.relation,
        method: Read,
    })

    const r = lodash.sample(res.data).id

    return r
}
