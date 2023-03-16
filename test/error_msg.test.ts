import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("FOOKIE JS check core functions.", async function () {
    await fookie.init()
    const res = await run({
        model: "setting",
        method: "read",
    })
    assert.equal(res.status, false) //TODO
})
