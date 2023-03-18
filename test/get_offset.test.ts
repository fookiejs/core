import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("get offset", async function () {
    await fookie.init()
    let res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "model",
        method: "read",
        query: {
            filter: { name: "model" },
            attributes: ["name"],
        },
    })
    assert.deepEqual(lodash.omit(res.data[0], ["name", "id"]), {})
})
