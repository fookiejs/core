import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"
import { nobody, everybody, system } from "@fookie/role"

it("recalculate_model_when_mixin_update.test", async function () {
    let flag = false
    @Model({ database: Store })
    class MixinUpdateMOdel {
        @Field({ type: Text, required: true })
        field: string
    }

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
