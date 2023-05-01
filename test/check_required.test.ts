import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store, database } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { mixin, After, Before } from "../packages/mixin"

it("async effect", async function () {
    await await model({
        name: "cr_model",
        database: Store,
        schema: {
            fieid: {
                type: Text,
                required: true,
            },
        },
    })

    const response = await run({
        model: "cr_model",
        method: Create,
        body: {},
    })

    assert.equal(response.status, false)
    assert.equal(response.error, "check_required")
})
