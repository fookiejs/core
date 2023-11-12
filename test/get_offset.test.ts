import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("get offset", async function () {
    const OffsetModel = await model({
        name: "OffsetModel",
        database: Database.Store,
        schema: {
            name: { type: Type.Text, required: true },
        },
    })

    const size = 10
    const offset = 3
    for (let i = 0; i < size; i++) {
        await run({
            token: process.env.SYSTEM_TOKEN,
            model: OffsetModel,
            method: Create,
            body: {
                name: "offset",
            },
        })
    }
    let res = await run<any, "read">({
        token: process.env.SYSTEM_TOKEN,
        model: OffsetModel,
        method: Read,
        query: {
            offset: offset,
            attributes: ["name"],
        },
    })

    assert.equal(res.data.length, size - offset)
})
