import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import * as Fookie from "../index"

it("Drop", async function () {
    const DropModel = await Fookie.Builder.model({
        name: "DropModel",
        database: Fookie.Dictionary.Database.store,
        schema: {
            name: { type: Fookie.Dictionary.Type.text, required: true },
        },
    })

    const resp = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: DropModel,
        method: Fookie.Method.Create,
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
        let res = await Fookie.run({
            model: DropModel,
            method: Fookie.Method.Read,
        })

        assert.equal(res.data.length, 0)
    }, 20)
})
