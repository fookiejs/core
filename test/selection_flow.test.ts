import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"
import * as Selection from "../packages/selection"

it("Selection flow", async function () {
    const selection_relation_model = await model({
        name: "selection_relation_model",
        database: Database.Store,
        schema: {
            field: {
                type: Type.Text,
            },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
            sum: {},
        },
    })

    const r = await run({
        model: selection_relation_model,
        method: Create,
        body: {
            field: "as",
        },
    })

    const selection_test = await await model({
        name: "selection_test",
        database: Database.Store,
        schema: {
            field1: {
                relation: selection_relation_model,
                selection: Selection.Random,
            },
            field2: {
                relation: selection_relation_model,
                selection: Selection.Random,
            },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
            sum: {},
        },
    })

    const res = await run({
        model: selection_test,
        method: Create,
        body: {},
    })

    assert.equal(true, typeof res.data.field1 === "string")
    assert.equal(true, typeof res.data.field2 === "string")
})
