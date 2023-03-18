import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

it("get offset", async function () {
    @Model({ database: Store })
    class OffsetModel {
        @Field({ type: Text, required: true })
        name: string
    }

    const size = 10
    const offset = 3
    for (let i = 0; i < size; i++) {
        await run({
            token: process.env.SYSTEM_TOKEN,
            model: OffsetModel,
            method: Create,
            body: {
                name: "offset",
            },
        })
    }
    let res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: OffsetModel,
        method: Read,
        query: {
            offset: offset,
            attributes: ["name"],
        },
    })

    assert.equal(res.data.length, size - offset)
})
