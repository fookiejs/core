import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store, database } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { mixin, After, Before } from "../packages/mixin"
import { nobody, everybody, system } from "../packages/role"

it("throw error modify", async function () {
    const throw_error = lifecycle(async function () {
        throw Error("modify throw error")
    })

    const mdl = await model({
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
