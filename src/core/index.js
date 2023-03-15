module.exports = async function (ctx) {
    ctx.store.model = []
    ctx.store.database = []
    ctx.store.mixin = []
    ctx.store.selection = []
    ctx.store.lifecycle = []
    ctx.store.setting = []
    await ctx.use(require("../helpers/after_before_calculater.js"))
    await ctx.use(require("../helpers/pk.js"))

    ctx.local.set("setting", {
        name: "accepted_query_field_keys",
        value: {
            keys: [
                "$gt",
                "$gte",
                "$lt",
                "$lte",
                "$inc",
                "$eq",
                "$ne",
                "$or",
                "$nor",
            ],
        },
    })

    // TYPES
    await ctx.use(require("./type/types"))
    // RULE
    ctx.local.set("lifecycle", require("./modify/default_state"))
    ctx.local.set("lifecycle", require("./modify/cascade_prepare"))
    ctx.local.set("lifecycle", require("./modify/reactive_prepare"))
    ctx.local.set("lifecycle", require("./rule/valid_types"))
    ctx.local.set("lifecycle", require("./rule/db_connect"))
    ctx.local.set("lifecycle", require("./rule/in_mixin_use"))
    ctx.local.set("lifecycle", require("./rule/has_field"))
    ctx.local.set("lifecycle", require("./rule/check_required"))
    ctx.local.set("lifecycle", require("./rule/only_client"))
    ctx.local.set("lifecycle", require("./rule/only_server"))
    ctx.local.set("lifecycle", require("./rule/can_write"))
    ctx.local.set("lifecycle", require("./rule/check_type"))
    ctx.local.set("lifecycle", require("./rule/valid_attributes"))
    ctx.local.set("lifecycle", require("./rule/valid_query"))
    ctx.local.set("lifecycle", require("./rule/has_model"))
    ctx.local.set("lifecycle", require("./rule/has_method"))
    ctx.local.set("lifecycle", require("./rule/has_body"))
    ctx.local.set("lifecycle", require("./rule/need_method_in_options"))
    ctx.local.set("lifecycle", require("./rule/valid_payload"))
    ctx.local.set("lifecycle", require("./rule/field_control"))
    ctx.local.set("lifecycle", require("./rule/unique"))
    ctx.local.set("lifecycle", require("./rule/uniqueGroup"))
    ctx.local.set("lifecycle", require("./rule/has_database"))
    ctx.local.set("lifecycle", require("./rule/has_entity"))
    ctx.local.set("lifecycle", require("./modify/default_payload"))

    //ROLES
    ctx.local.set("lifecycle", require("./role/everybody"))
    ctx.local.set("lifecycle", require("./role/nobody"))
    ctx.local.set("lifecycle", require("./role/system"))

    //EFFECT
    ctx.local.set("lifecycle", require("./effect/log"))
    ctx.local.set("lifecycle", require("./effect/metric"))
    ctx.local.set("lifecycle", require("./effect/db_disconnect"))
    ctx.local.set("lifecycle", require("./effect/update_models"))
    ctx.local.set("lifecycle", require("./effect/cascade_delete"))
    ctx.local.set("lifecycle", require("./effect/reactive_delete"))
    ctx.local.set("lifecycle", require("./effect/drop"))
    ctx.local.set("lifecycle", require("./effect/reactives"))

    //FILTERS
    ctx.local.set("lifecycle", require("./filter/simplified"))

    //MODIFIES
    ctx.local.set("lifecycle", require("./modify/set_default"))
    ctx.local.set("lifecycle", require("./modify/filter_fields"))

    ctx.local.set("lifecycle", require("./modify/selection"))
    ctx.local.set("lifecycle", require("./modify/pk"))
    ctx.local.set("lifecycle", require("./modify/set_mixin"))
    ctx.local.set("lifecycle", require("./modify/has_mixin"))
    ctx.local.set("lifecycle", require("./modify/database_modify"))
    ctx.local.set("lifecycle", require("./modify/fix_schema"))

    // MIXIN
    ctx.local.set("mixin", require("./mixin/after"))
    ctx.local.set("mixin", require("./mixin/before"))

    //DATABASES
    ctx.local.set("database", require("./database/store"))

    //--------------------TRICKY SET--------------------------
    {
        const model = require("./model/model.js")
        model.methods = {}
        model.methods.create = async function (_payload, _ctx) {
            _ctx.local.set("model", _payload.body)
        }
        ctx.local.set(
            "model",
            ctx.helpers.schemaFixer(ctx.lodash.assign({}, model))
        )
        model.name = "model2"
        await ctx.run({
            token: process.env.SYSTEM_TOKEN,
            model: "model",
            method: "create",
            body: model,
            response: {},
        })
        let mdl = ctx.local.get("model", "model2")
        mdl.name = "model"
        ctx.local.set("model", mdl)
        ctx.local.delete("model", "model2")
    }
    //-------------------------------------------------------

    // PLUGINS
    await ctx.use(require("./selection/selections"))

    //MODEL
    await ctx.use(require("./model/lifecycle.js"))
    await ctx.use(require("./model/setting.js"))
    await ctx.use(require("./model/selection.js"))
    await ctx.use(require("./model/mixin.js"))
    await ctx.use(require("./model/database.js"))
    await ctx.use(require("./model/type.js"))
}
