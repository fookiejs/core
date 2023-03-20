import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"
import { nobody, everybody, system } from "@fookie/role"

it("get limit", async function () {
    @Model({ database: Store })
    class LimitTestModel {
        @Field({ type: Text, required: true })
        field: string
    }

    for (let i = 0; i < 10; i++) {
        await run({
            model: LimitTestModel,
            method: Create,
            body: {
                field: "val",
            },
        })
    }
    const res = await run({
        model: LimitTestModel,
        method: Read,
        query: {
            limit: 2,
        },
    })
    assert.equal(res.data.length, 2)
})
