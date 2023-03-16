import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("Instance needs this models", async function () {
    await fookie.init()
    assert.equal(fookie.local.has("model", "lifecycle"), true)
    assert.equal(fookie.local.has("model", "mixin"), true)
    assert.equal(fookie.local.has("model", "database"), true)
    assert.equal(fookie.local.has("model", "setting"), true)
    assert.equal(fookie.local.has("model", "model"), true)
})
