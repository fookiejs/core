import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"
import { After, Before } from "../src/mixins"

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
