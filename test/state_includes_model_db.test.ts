import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("State must be inclode model and model database", async function () {
    await lifecycle({
        name: "state_model_check",
        function: async function (payload, ctx, state) {
            return ctx.lodash.has(state, "model") && ctx.lodash.has(state, "database")
        },
    })
    let res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "model",
        method: "create",
        body: {
            name: "state_test_1",
            database: Store,
            schema: {
                test_field: {
                    type: Text,
                },
            },
            lifecycle: {
                create: {
                    rule: ["state_model_check"],
                },
            },
        },
    })

    await run({
        model: "state_test_1",
        method: "create",
        body: {
            test_field: "yo",
        },
    })
    assert.equal(res.status, true)
})
