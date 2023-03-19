import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

it("async effect", async function () {
    @Model({ database: Store })
    class InvalidTokenModel {
        @Field({ type: Text, required: true })
        name: string

        @Field({ type: Text, required: true })
        password: string
    }
    const res = await run({
        token: 1,
        model: InvalidTokenModel,
        method: Read,
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "validate_payload")
})
