import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("throw error modify", async function () {
    const throw_error = lifecycle(async function () {
        throw Error("modify throw error")
    })

    const mdl = await model({
        name: "throw_error_model",
        database: Database.Store,
        schema: {
            fieid: {
                type: Type.Text,
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
