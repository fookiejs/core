import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("pk", async function () {
    await fookie.init()
    assert.equal(fookie.helpers.pk("model"), "id")
    assert.equal(fookie.helpers.pk("database"), "id")
})
