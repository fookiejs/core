import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

it("Unique", async function () {
    const only_client = model({
        name: "only_client",
        database: Store,
        schema: {
            val: {
                type: Number,
                only_client: true,
            },
        },
    })

    const res = await run({
        model: only_client,
        method: Create,
        body: {
            val: 1,
        },
    })

    const res2 = await run({
        model: "only_client",
        method: Create,
        body: {},
    })

    assert.equal(res.status, true)
    assert.equal(res2.status, false)
})
