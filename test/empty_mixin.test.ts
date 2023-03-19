import { it, describe, assert } from "vitest"
import { model, run, models, mixin } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

it("mixin empty", async function () {
    const mx = mixin({})

    assert.equal(!!mx.bind, true)
    assert.equal(!!mx.schema, true)
})
