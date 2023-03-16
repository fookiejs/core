import * as lodash from "lodash"

export default async function (payload, state) {
    function uniqMerge(target, source) {
        return lodash.uniq([...target, ...source])
    }
    let options = {
        arrayMerge: uniqMerge,
    }

    let methods = ["create", "read", "update", "delete", "count", "test"]
    methods = methods.concat(lodash.keys(payload.body.lifecycle))
    methods = methods.concat(lodash.keys(payload.body.methods))
    methods = lodash.uniq(methods)

    for (let f of lodash.keys(payload.body.schema)) {
        payload.body.schema[f] = ctx.helpers.deepMerge(
            payload.body.schema[f],
            {
                write: [],
                read: [],
            },
            options
        )
    }

    for (let method of methods) {
        payload.body.lifecycle[method] = ctx.helpers.deepMerge(
            payload.body.lifecycle[method],
            {
                modify: [],
                effect: [],
                rule: [],
                preRule: [],
                role: [],
                filter: [],
            },
            options
        )
    }
    payload.body.mixins = lodash.uniq(ctx.helpers.deepMerge(payload.body.mixin, ["after", "before"], options))
}
