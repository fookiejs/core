import * as lodash from "lodash"
import { models } from "./generators"
import type { PayloadInterface, ModelInterface, StateInterface } from "./declerations"

export { models }
export async function run(
    payload:
        | PayloadInterface
        | (Omit<PayloadInterface, "model"> & { model: Function })
        | (Omit<PayloadInterface, "model"> & { model: string }),
    state?: StateInterface
) {
    let model: ModelInterface
    if (typeof payload.model === "function") {
        const val = payload.model.name
        model = models.find((model) => model.name === val)
    } else if (typeof payload.model === "string") {
        const val = payload.model
        model = models.find((model) => model.name === val)
    }

    return await _run({ model, ...lodash.omit(payload, "model") }, state)
}

async function _run(payload: PayloadInterface, state?: StateInterface): Promise<any> {
    return 1
}
