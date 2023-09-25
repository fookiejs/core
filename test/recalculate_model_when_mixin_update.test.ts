import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"

it("recalculate_model_when_mixin_update.test", async function () {
    let flag = false
    const MixinUpdateMOdel = await model({
        name: "MixinUpdateMOdel",
        database: Database.Store,
        schema: {
            field: { type: Type.Text, required: true },
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

    // @ts-ignore TODO
    Mixin.After.bind.read.effect.push(test_effect)

    // @ts-ignore TODO
    Mixin.Before.bind.read.effect.push(test_effect)

    await run({
        model: MixinUpdateMOdel,
        method: Read,
    })

    assert.equal(flag, true)
})
