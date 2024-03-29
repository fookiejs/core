import { Method, ResponseInterface, StateInterface } from "../../../../types"

export function set_default_state(state: Partial<StateInterface>): StateInterface {
    state.metrics = {
        start: Date.now(),
        lifecycle: [],
    }
    state.todo = []
    return state as StateInterface
}

export function create_response<E>(method: Method): ResponseInterface<E, typeof method> {
    return {
        data: null,
        status: false,
        error: null,
        validation_error: {},
    }
}
