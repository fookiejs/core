import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
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
