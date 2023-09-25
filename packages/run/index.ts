import * as lodash from "lodash"
import pre_rule from "./src/lifecycles/pre_rule"
import modify from "./src/lifecycles/modify"
import role from "./src/lifecycles/role"
import rule from "./src/lifecycles/rule"
import method from "./src/lifecycles/method"
import filter from "./src/lifecycles/filter"
import effect from "./src/lifecycles/effect"
import { v4 } from "uuid"
import { PayloadInterface, StateInterface, ResponseInterface } from "../../types"

import { set_default_state, create_response } from "./src/lifecycles/flow"

if (!process.env.SYSTEM_TOKEN) {
    process.env.SYSTEM_TOKEN = v4()
}

export async function run(payload: PayloadInterface, _state = {} as Partial<StateInterface>): Promise<ResponseInterface> {
    const state = set_default_state(_state)
    payload.response = create_response()

    if (!(await pre_rule(payload, state))) {
        return payload.response
    }

    await modify(payload, state)

    if (!(await role(payload, state))) {
        return payload.response
    }

    if (!(await rule(payload, state))) {
        payload.response.data = null
        return payload.response
    }

    payload.response.status = true
    await method(payload, state)
    await filter(payload, state)
    await effect(payload, state)
    return lodash.assign({}, payload.response)
}
