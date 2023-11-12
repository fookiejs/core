import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("mixin empty", async function () {
    const mx = Fookie.Builder.mixin({})

    assert.equal(!!mx.bind, true)
    assert.equal(!!mx.schema, true)
})
