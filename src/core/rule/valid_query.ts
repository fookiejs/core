module.exports = {
    name: "valid_query",
    wait: true,
    function: async function (payload, ctx, state) {
        const accepted_keywords = ctx.local.get(
            "setting",
            "accepted_query_field_keys"
        )
        let filter_keys = ctx.lodash.keys(payload.query.filter)
        let model_keys = ctx.lodash.keys(state.model.schema)
        if (
            ctx.lodash.has(payload.query, "filter") &&
            !ctx.lodash.isObject(payload.query.filter)
        )
            return false
        if (
            ctx.lodash.has(payload.query, "limit") &&
            !ctx.lodash.isNumber(payload.query.limit)
        )
            return false
        if (
            ctx.lodash.has(payload.query, "offset") &&
            !ctx.lodash.isNumber(payload.query.offset)
        )
            return false
        if (
            ctx.lodash.difference(filter_keys, [
                ...model_keys,
                state.database.pk,
            ]).length > 0
        )
            return false

        for (let key of ctx.lodash.keys(payload.query.filter)) {
            let field = payload.query.filter[key]
            if (
                ctx.lodash.isObject(field) &&
                ctx.lodash.difference(
                    ctx.lodash.keys(field),
                    accepted_keywords.value.keys
                ).length != 0
            ) {
                return false
            }
            if (ctx.lodash.isObject(field)) {
                if (field.$gte && !ctx.lodash.isNumber(field.$gte)) {
                    return false
                }
                if (field.$gt && !ctx.lodash.isNumber(field.$gt)) {
                    return false
                }
                if (field.$lte && !ctx.lodash.isNumber(field.$lte)) {
                    return false
                }
                if (field.$lt && !ctx.lodash.isNumber(field.$lt)) {
                    return false
                }
                if (field.$inc && !ctx.lodash.isString(field.$inc)) {
                    return false
                }
                if (field.$or && !ctx.lodash.isArray(field.$or)) {
                    return false
                }
                if (field.$nor && !ctx.lodash.isArray(field.$nor)) {
                    return false
                }
            }
        }
        return true
    },
}
