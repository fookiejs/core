import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("async effect", async function () {
    const res = await run({
        model: "model",
        method: "invalid_method",
    })
    assert.equal(res.status, false)
    assert.equal(res.error, "has_method")
})
