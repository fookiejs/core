import * as lodash from "lodash"

const valid_attributes: LifecycleFunction = async function (payload, state) {
    return payload.query.attributes.every(function (k) {
        return lodash.keys(payload.model.schema).includes(k)
    })
}

export default valid_attributes
