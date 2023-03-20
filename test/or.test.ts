import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("$or", async function () {
    const OrTestNumber = model({
        name: "OrTestNumber",
        database: Store,
        schema: {
            val: {
                type: Number,
                required: true,
            },
        },
    })
    for (let i = 0; i < 100; i++) {
        await run({
            token: process.env.SYSTEM_TOKEN,
            model: OrTestNumber,
            method: Create,
            body: {
                val: Math.round(Math.random() * 10),
            },
        })
    }

    const arr = [1, 2, 3]
    const res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: OrTestNumber,
        method: Read,
        query: {
            filter: {
                val: {
                    or: arr,
                },
            },
        },
    })

    for (const number of res.data) {
        if (!arr.includes(number.val)) {
            throw Error("must be 1 or 2 but is " + number.val)
        }
    }

    const res2 = await run({
        token: process.env.SYSTEM_TOKEN,
        model: OrTestNumber,
        method: Read,
        query: {
            filter: {
                val: {
                    notor: arr,
                },
            },
        },
    })
    for (const number of res2.data) {
        if (arr.includes(number.val)) {
            throw Error("not must be 1 or 2 but is " + number.val)
        }
    }
})
