import { run } from ".."
import { Read } from "../methods"
import * as lodash from "lodash"
export const Random = async function (model: ModelInterface) {
    let res = await run({
        model: model,
        method: Read,
    })
    return lodash.sample(res.data)
}
