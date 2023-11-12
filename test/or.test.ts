import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("$or", async function () {
    const OrTestNumber = await Fookie.Builder.model({
        name: "OrTestNumber",
        database: Fookie.Dictionary.Database.store,
        schema: {
            val: {
                type: Fookie.Dictionary.Type.integer,
                required: true,
            },
        },
    })
    for (let i = 0; i < 100; i++) {
        await Fookie.run({
            token: process.env.SYSTEM_TOKEN,
            model: OrTestNumber,
            method: Fookie.Method.Create,
            body: {
                val: Math.round(Math.random() * 10),
            },
        })
    }

    const arr = [1, 2, 3]
    const res = await Fookie.run<any, "read">({
        token: process.env.SYSTEM_TOKEN,
        model: OrTestNumber,
        method: Fookie.Method.Read,
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

    const res2 = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: OrTestNumber,
        method: Fookie.Method.Read,
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
