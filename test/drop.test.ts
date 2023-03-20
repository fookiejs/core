import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("Drop", async function () {
    @Model({ database: Store })
    class DropModel {
        @Field({ type: Text, required: true })
        name: string
    }
    await run({
        model: DropModel,
        method: Create,
        body: {
            name: "test_1",
        },
        options: {
            drop: 1,
        },
    })

    await new Promise((resolve) => setTimeout(resolve, 20))

    setTimeout(async () => {
        let res = await run({
            model: DropModel,
            method: Read,
        })

        assert.equal(res.data.length, 0)
    }, 20)
})
