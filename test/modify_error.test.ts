import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("throw error modify", async function () {
    const throw_error = Fookie.Builder.lifecycle(async function () {
        throw Error("modify throw error")
    })

    const mdl = await Fookie.Builder.model({
        name: "throw_error_model",
        database: Fookie.Dictionary.Database.store,
        schema: {
            fieid: {
                type: Fookie.Dictionary.Type.text,
            },
        },
        bind: {
            read: {
                modify: [throw_error],
            },
        },
    })

    const res = await Fookie.run({
        model: mdl,
        method: Fookie.Method.Read,
    })
})
