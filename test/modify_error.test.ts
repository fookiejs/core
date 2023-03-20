import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("throw error modify", async function () {
    const throw_error = lifecycle(async function () {
        throw Error("modify throw error")
    })

    const mdl = model({
        name: "throw_error_model",
        database: Store,
        schema: {
            fieid: {
                type: Text,
            },
        },
        bind: {
            read: {
                modify: [throw_error],
            },
        },
    })

    const res = await run({
        model: mdl,
        method: Read,
    })
})
