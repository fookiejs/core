import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

it("Attributes", async function () {
    let res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "model",
        method: Create,
        body: {
            database: "invalidDB",
            name: "invaliddbmodel",
            schema: {
                a: {
                    type: Text,
                },
            },
        },
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "has_database")
})
