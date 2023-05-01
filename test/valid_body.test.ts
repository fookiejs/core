import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store, database } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { mixin, After, Before } from "../packages/mixin"

it("valid body", async function () {
    const has_body_model = await model({
        name: "has_body_model",
        database: Store,
        schema: {
            field: {
                type: Text,
                required: true,
            },
        },
    })

    const res = await run({
        model: has_body_model,
        method: Create,
        body: 1,
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "validate_payload")
})
