import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"

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
