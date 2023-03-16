import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("async effect", async function () {
    await init

    const res = await run({
        token: "system_token",
        model: "model",
        method: "create",
        body: {
            mixins: ["abc"],
            name: "async_effect_model",
            database: Store,
            schema: {
                fieid: {
                    type: Text,
                },
            },
        },
    })

    assert.equal(res.status, false)
})
