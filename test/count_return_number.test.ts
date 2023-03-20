import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"

it("Count return value must be number", async function () {
    @Model({ database: Store })
    class ModelToCount {
        @Field({ type: Text, required: true })
        name: string

        @Field({ type: Text, required: true })
        password: string
    }

    let res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: ModelToCount,
        method: Count,
    })
    assert.equal(typeof res.data, "number")
})
