import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

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

    setTimeout(async () => {
        let res = await run({
            model: DropModel,
            method: Read,
        })

        assert.equal(res.data.length, 0)
    }, 20)
})
