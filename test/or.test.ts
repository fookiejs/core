import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"

it("$or", async function () {
    const OrTestNumber = await model({
        name: "OrTestNumber",
        database: Database.Store,
        schema: {
            val: {
                type: Type.Integer,
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
