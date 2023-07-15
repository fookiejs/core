import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"
import { nobody, everybody, system } from "../packages/role"

it("recalculate_model_when_mixin_update.test", async function () {
    let flag = false
    const MixinUpdateMOdel = await model({
        name: "MixinUpdateMOdel",
        database: Store,
        schema: {
            field: { type: Text, required: true },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
        },
    })

    const test_effect = lifecycle(async function () {
        flag = true
    })

    After.bind.read.effect.push(test_effect)
    Before.bind.read.effect.push(test_effect)

    await run({
        model: MixinUpdateMOdel,
        method: Read,
    })

    assert.equal(flag, true)
})
