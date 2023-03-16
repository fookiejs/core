import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("invalid type", async function () {
    await init
    let res = await run({
        token: "system_token",
        model: "database",
        method: "create",
        body: {
            name: "exampledb",
            pk: "id",
            types: ["invalid_type"],
        },
    })
    assert.equal(res.status, false)
    assert.equal(res.error, "valid_types")
})

it("valid type", async function () {
    await init
    let res = await run({
        token: "system_token",
        model: "database",
        method: "create",
        body: {
            name: "abcdb",
            pk: "id",
            types: ["string"],
            modify: async function () {},
        },
    })

    assert.equal(res.status, true)
})
