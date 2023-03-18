import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

it("get limit", async function () {
    @Model({ database: Store })
    class LimitTestModel {
        @Field({ type: Text, required: true })
        field: string
    }

    for (let i = 0; i < 10; i++) {}
    await run({
        model: LimitTestModel,
        method: Create,
        body: {
            field: "val",
        },
    })

    const res = await run({
        model: LimitTestModel,
        method: Read,
        query: {
            limit: 2,
        },
    })
    assert.equal(res.data.length, 2)
})
