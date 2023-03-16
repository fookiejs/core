import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("recalculate_model_when_mixin_update.test", async function () {
    const assert = require("assert")
    const fookie = require("../src/index")
    await fookie.init()
    let after = fookie.local.get("mixin", "after")
    let before = fookie.local.get("mixin", "before")
    after.object.lifecycle.read.effect.push("test_effect")
    before.object.lifecycle.read.effect.push("test_effect")

    await fookie.lifecycle({
        name: "test_effect",
        function: async function () {},
    })

    let after_res = await run({
        model: "mixin",
        method: "update",
        token: "system_token",
        query: {
            filter: {
                name: "after",
            },
        },
        body: {
            object: after.object,
        },
    })

    let before_res = await run({
        model: "mixin",
        method: "update",
        token: "system_token",
        query: {
            filter: {
                name: "after",
            },
        },
        body: {
            object: after.object,
        },
    })
    let models = fookie.local.all("model")
    models.forEach((model) => {
        assert.equal(fookie.lodash.includes(model.lifecycle.read.effect, "test_effect"), true) //REFAKTÖR ET
    })
})
