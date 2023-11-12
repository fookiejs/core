import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("Drop", async function () {
    const DropModel = await model({
        name: "DropModel",
        database: Database.Store,
        schema: {
            name: { type: Type.Text, required: true },
        },
    })

    const resp = await run({
        token: process.env.SYSTEM_TOKEN,
        model: DropModel,
        method: Create,
        body: {
            name: "test_1",
        },
        options: {
            drop: 10,
        },
    })
    assert.equal(resp.status, true)
    await new Promise((resolve) => setTimeout(resolve, 200))

    setTimeout(async () => {
        let res = await run({
            model: DropModel,
            method: Read,
        })

        assert.equal(res.data.length, 0)
    }, 20)
})
