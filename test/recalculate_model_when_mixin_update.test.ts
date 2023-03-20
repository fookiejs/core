import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"
import { After, Before } from "../packages/mixins"

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
