import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("async effect", async function () {
    const res = await Fookie.run({
        model: "not_existed_model_1",
        method: "read",
    })

    assert.equal(res.status, false)
})
