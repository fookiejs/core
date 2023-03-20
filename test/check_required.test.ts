import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"

it("async effect", async function () {
    await model({
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
