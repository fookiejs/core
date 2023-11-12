import * as lodash from "lodash"
import pre_rule from "./src/lifecycles/pre_rule"
import modify from "./src/lifecycles/modify"
import role from "./src/lifecycles/role"
import rule from "./src/lifecycles/rule"
import method from "./src/lifecycles/method"
import filter from "./src/lifecycles/filter"
import effect from "./src/lifecycles/effect"
import { PayloadInterface, StateInterface, ResponseInterface, Method } from "../../types"
import { set_default_state, create_response } from "./src/lifecycles/flow"

export async function run<E, M extends Method>(
    payload: PayloadInterface<E, M>,
    _state: Partial<StateInterface> = {}
): Promise<ResponseInterface<E, M>> {
    const state = set_default_state(_state)
    payload.response = create_response<E>(payload.method)

    if (await pre_rule(payload, state)) {
        await modify(payload, state)
        if (await role(payload, state)) {
            if (await rule(payload, state)) {
                payload.response.status = true
                await method(payload, state)
                await filter(payload, state)
                await effect(payload, state)
                return lodash.assign({}, payload.response)
            }
        }
    }
    return lodash.assign({}, payload.response)
}
