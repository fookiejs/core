import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("Model required and crud operations", async function () {
    await fookie.init()
    let res = await run({
        token: "system_token",
        model: "model",
        method: "read",
    })
    assert.equal(res.status, true)
    let arr = res.data
    for (let model of arr) {
        assert.equal(lodash.has(model.methods, "create"), true)
        assert.equal(lodash.has(model.methods, "read"), true)
        assert.equal(lodash.has(model.methods, "count"), true)
        assert.equal(lodash.has(model.methods, "test"), true)
        assert.equal(lodash.has(model.methods, "update"), true)
        assert.equal(lodash.has(model.methods, "delete"), true)
    }
})
