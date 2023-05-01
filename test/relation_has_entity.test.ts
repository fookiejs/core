import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"

it("Relation has_entity", async function () {
    const RelationNotExistedModel = await model({
        name: "RelationNotExistedModel",
        database: Store,
        schema: {
            field: { type: Text, required: true },
        },
    })

    let relation_not_existed_model_test = await model({
        name: "relation_not_existed_model_test",
        database: Store,
        schema: {
            model: {
                relation: RelationNotExistedModel,
                required: true,
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
