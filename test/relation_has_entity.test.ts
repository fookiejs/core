import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("Relation has_entity", async function () {
    const RelationNotExistedModel = await Fookie.Builder.model({
        name: "RelationNotExistedModel",
        database: Fookie.Dictionary.Database.store,
        schema: {
            field: { type: Fookie.Dictionary.Type.text, required: true },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
        },
    })

    let relation_not_existed_model_test = await Fookie.Builder.model({
        name: "relation_not_existed_model_test",
        database: Fookie.Dictionary.Database.store,
        schema: {
            model: {
                relation: RelationNotExistedModel,
                required: true,
            },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
        },
    })

    const res = await Fookie.run({
        model: relation_not_existed_model_test,
        method: Fookie.Method.Create,
        body: {
            model: "not_existed_model_has_entity",
        },
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "has_entity")
})
