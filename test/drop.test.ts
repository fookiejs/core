import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"

it("Drop", async function () {
    const DropModel = await model({
        name: "DropModel",
        database: Store,
        schema: {
            name: { type: Text, required: true },
        },
    })

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
