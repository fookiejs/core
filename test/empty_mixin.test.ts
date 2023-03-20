import { it, describe, assert } from "vitest"
import { model, run, models, mixin } from ".."
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("mixin empty", async function () {
    const mx = mixin({})

    assert.equal(!!mx.bind, true)
    assert.equal(!!mx.schema, true)
})
