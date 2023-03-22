import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store, database } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { mixin, After, Before } from "../packages/mixin"
import { nobody, everybody, system } from "../packages/role"

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
