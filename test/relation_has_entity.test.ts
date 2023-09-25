import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"

it("Relation has_entity", async function () {
    const RelationNotExistedModel = await model({
        name: "RelationNotExistedModel",
        database: Database.Store,
        schema: {
            field: { type: Type.Text, required: true },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
        },
    })

    let relation_not_existed_model_test = await model({
        name: "relation_not_existed_model_test",
        database: Database.Store,
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
