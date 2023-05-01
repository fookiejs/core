import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Integer, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"

it("$or", async function () {
    const OrTestNumber = await model({
        name: "OrTestNumber",
        database: Store,
        schema: {
            val: {
                type: Integer,
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
                    in: arr,
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
                    not_in: arr,
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
