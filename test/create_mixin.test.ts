import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("mixin", async function () {
    await fookie.init()
    let res = await fookie.mixin({
        name: "test_mixin",
        object: {
            lifecycle: {},
        },
    })
})
