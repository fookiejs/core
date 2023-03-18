import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

it("throw error modify", async function () {
    const throw_error = lifecycle(async function () {
        throw Error("modify throw error")
    })

    await run({
        token: process.env.SYSTEM_TOKEN,
        model: "model",
        method: Create,
        body: {
            name: "throw_error_model",
            database: Store,
            schema: {
                fieid: {
                    type: Text,
                },
            },
            lifecycle: {
                read: {
                    modify: [throw_error],
                },
            },
        },
    })

    const res = await run({
        model: "throw_error_model",
        method: "read",
    })
})
