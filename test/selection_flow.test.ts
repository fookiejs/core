import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("Selection flow", async function () {
    const fookie = require("../src/index")
    await fookie.init()
    await run({
        model: "model",
        method: "create",
        token: "system_token",
        body: {
            name: "selection_test",
            database: Store,
            schema: {
                field1: {
                    relation: "model",
                    selection: "local_random",
                },
                field2: {
                    relation: "model",
                    selection: "random",
                },
            },
        },
    })

    const res = await run({
        model: "selection_test",
        method: "create",
        token: "system_token",
        body: {},
    })

    assert.equal(true, typeof res.data.field1 === "string")
    assert.equal(true, typeof res.data.field2 === "string")
})
