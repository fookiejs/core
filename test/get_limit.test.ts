import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

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
