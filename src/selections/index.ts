import { run } from ".."
import { Read } from "../methods"
import * as lodash from "lodash"
export const Random = async function (payload: PayloadInterface, state: StateInterface) {
    let res = await run({
        model: payload.model,
        method: Read,
    })
    return lodash.sample(res.data)
}
