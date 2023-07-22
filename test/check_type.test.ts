import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"

it("check_type", async function () {
    const model_check_type = await model({
        name: "model_check_type",
        database: Store,
        schema: {
            field: {
                type: Text,
            },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
        },
    })

    const res = await run({
        model: model_check_type,
        method: Create,
        body: {
            field: 123,
        },
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "check_type")
})
