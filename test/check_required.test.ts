import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("async effect", async function () {
    const cr_model = await Fookie.Builder.model({
        name: "cr_model",
        database: Fookie.Dictionary.Database.store,
        schema: {
            fieid: {
                type: Fookie.Dictionary.Type.text,
                required: true,
            },
        },
        bind: {
            test: {},
            create: {},
        },
    })

    const response = await Fookie.run({
        model: cr_model,
        method: Fookie.Method.Create,
        body: {},
    })

    assert.equal(response.status, false)
    assert.equal(response.error, "check_required")
})
