import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle, type, database, mixin } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"

it("mixin empty", async function () {
    const mx = mixin({})

    assert.equal(!!mx.bind, true)
    assert.equal(!!mx.schema, true)
})
