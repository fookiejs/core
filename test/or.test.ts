import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("$or", async function () {
    const fookie = require("../src/index")

    model({
        name: "number",
        database: Store,
        schema: {
            val: {
                type: "number",
                required: true,
            },
        },
    })
    for (let i = 0; i < 100; i++) {
        await run({
            token: process.env.SYSTEM_TOKEN,
            model: "number",
            method: "create",
            body: {
                val: Math.round(Math.random() * 10),
            },
        })
    }

    const arr = [1, 2, 3]
    const res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "number",
        method: "read",
        query: {
            filter: {
                val: {
                    $or: arr,
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
        model: "number",
        method: "read",
        query: {
            filter: {
                val: {
                    $nor: arr,
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
