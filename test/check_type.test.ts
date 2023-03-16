import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("async effect", async function () {
    await init

    await run({
        token: "system_token",
        model: "model",
        method: "create",
        body: {
            name: "ct_model",
            database: Store,
            schema: {
                field: {
                    type: Text,
                },
            },
        },
    })

    const res = await run({
        model: "ct_model",
        method: "create",
        body: {
            field: 123,
        },
    })
    assert.equal(res.status, false)
    assert.equal(res.error, "check_type")
})
