import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("Delete model", async function () {
    await fookie.init()
    let res = await run({
        token: "system_token",
        model: "model",
        method: "delete",
        query: {
            filter: { name: "setting" },
        },
    })
    assert.equal(res.status, true)
})
