import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("async effect", async function () {
    const res = await run({
        model: "not_existed_model_1",
        method: "read",
    })

    assert.equal(res.status, false)
})
