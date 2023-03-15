const poolFilter = require("../../helpers/poolFilter.js")

module.exports = {
    name: "store",
    pk: "id",
    types: [
        "object",
        "string",
        "number",
        "boolean",
        "function",
        "buffer",
        "array",
    ],
    connect: async function () { },
    disconnect: async function () { },
    modify: async function (model, ctx, state) {
        if (!ctx.lodash.has(ctx.store, model.name)) {
            ctx.store[model.name] = []
        }
        for (let f in model.schema) {
            if (typeof model.schema[f].relation == "string") {
                model.schema[f].type = "string"
            }
        }

        model.methods.read = async function (_payload, _ctx, _state) {
            if (_payload.query.limit == 0)
                _payload.query.limit = Infinity
            const pool = _ctx.store[_payload.model]
            const filter = _payload.query.filter
            const attributes = ["id"].concat(_payload.query.attributes)
            let res = poolFilter(pool, filter)
            res = res.map(function (entity) { return _ctx.lodash.pick(entity, attributes) })
            res = _ctx.lodash.slice(
                res,
                _payload.query.offset,
                _payload.query.offset +
                _payload.query.limit
            )
            _payload.response.data = res
        }

        model.methods.create = async function (_payload, _ctx, _state) {
            const attributes = ["id"].concat(_payload.query.attributes)
            _payload.body.id = ctx.helpers.uuid.v4().replace("-", "")
            _ctx.store[_payload.model].push(_payload.body)
            _payload.response.data = _ctx.lodash.pick(_payload.body, attributes)
        }


        model.methods.update = async function (_payload, _ctx, _state) {
            let pool = _ctx.store[_payload.model]
            let database = _ctx.local.get("database", model.database)
            let ids = poolFilter(pool, _payload.query.filter).map(
                function (i) { return i[database.pk] }
            )
            for (let item of pool) {
                for (const key in _payload.body) {
                    if (ids.includes(item.id)) {
                        item[key] = _payload.body[key]
                    }
                }
            }
            _ctx.store[_payload.model] = pool
            _payload.response.data = true
        }

        model.methods.delete = async function (_payload, _ctx, _state) {
            const pool = _ctx.store[_payload.model]
            const filtered = poolFilter(pool, _payload.query.filter).map(function (f) { return f.id })
            const rejected = _ctx.lodash.reject(pool, function (entity) { return filtered.includes(entity.id) })
            _ctx.store[_payload.model] = rejected
            _payload.response.data = true
        }

        model.methods.count = async function (_payload, _ctx, _state) {
            let pool = _ctx.store[_payload.model]
            let filtered = poolFilter(pool, _payload.query.filter)
            _payload.response.data = filtered.length
        }
    },
}
