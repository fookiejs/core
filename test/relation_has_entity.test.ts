import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

it("Relation has_entity", async function () {
    class InvalidQueryModel {
        @Field({ type: Text, required: true })
        field2: string
    }

    let res = model({
        name: "relation_test",
        database: Store,
        schema: {
            model: {
                relation: InvalidQueryModel,
                require: true,
            },
        },
    })

    res = await run({
        model: "relation_test",
        method: Create,
        body: {
            model: "not_existed_model_has_entity",
        },
    })
    assert.equal(res.status, false)
})
