import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("recalculate_model_when_mixin_update.test", async function () {
    let flag = false
    const MixinUpdateMOdel = await Fookie.Builder.model({
        name: "MixinUpdateMOdel",
        database: Fookie.Dictionary.Database.store,
        schema: {
            field: { type: Fookie.Dictionary.Type.text, required: true },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
        },
    })

    const test_effect = Fookie.Builder.lifecycle(async function () {
        flag = true
    })

    // @ts-ignore TODO
    Fookie.Dictionary.Mixin.after.bind.read.effect.push(test_effect)

    // @ts-ignore TODO
    Fookie.Dictionary.Mixin.before.bind.read.effect.push(test_effect)

    await Fookie.run({
        model: MixinUpdateMOdel,
        method: Fookie.Method.Read,
    })

    assert.equal(flag, true)
})
