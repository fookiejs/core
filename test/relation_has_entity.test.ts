import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("Relation has_entity", async function () {
    @Model({ database: Store })
    class RelationNotExistedModel {
        @Field({ type: Text, required: true })
        field: string
    }

    let relation_not_existed_model_test = model({
        name: "relation_not_existed_model_test",
        database: Store,
        schema: {
            model: {
                relation: RelationNotExistedModel,
                require: true,
            },
        },
    })

    const res = await run({
        model: relation_not_existed_model_test,
        method: Create,
        body: {
            model: "not_existed_model_has_entity",
        },
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "has_entity")
})
