import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("async effect", async function () {
    const res = local.query("model", {
        name: "lifecycle",
    })

    assert.equal(lodash.isArray(res), true)
    assert.equal(res[0].name, "lifecycle")
})
