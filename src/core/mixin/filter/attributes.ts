import * as lodash from "lodash"
import { Filter } from "../../lifecycle-function"
import { Method } from "../../method"

export default Filter.new({
    key: "attributes",
    execute: async function (payload, response) {
        if (payload.method === Method.READ && Array.isArray(response)) {
            response.forEach((entity, index) => {
                const picked = lodash.pick(entity, payload.query.attributes)
                Object.keys(response[index]).forEach((key) => delete response[index][key])
                Object.assign(response[index], picked)
            })
        }

        if (payload.method === Method.CREATE) {
            const picked = lodash.pick(response, payload.query.attributes)
            Object.keys(response).forEach((key) => delete response[key])

            Object.assign(response, picked)
        }
    },
})
