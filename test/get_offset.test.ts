import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("get offset", async function () {
    const OffsetModel = await Fookie.Builder.model({
        name: "OffsetModel",
        database: Fookie.Dictionary.Database.store,
        schema: {
            name: { type: Fookie.Dictionary.Type.text, required: true },
        },
    })

    const size = 10
    const offset = 3
    for (let i = 0; i < size; i++) {
        await Fookie.run({
            token: process.env.SYSTEM_TOKEN,
            model: OffsetModel,
            method: Fookie.Method.Create,
            body: {
                name: "offset",
            },
        })
    }
    let res = await Fookie.run<any, "read">({
        token: process.env.SYSTEM_TOKEN,
        model: OffsetModel,
        method: Fookie.Method.Read,
        query: {
            offset: offset,
            attributes: ["name"],
        },
    })

    assert.equal(res.data.length, size - offset)
})
