import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store, database } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { mixin, After, Before } from "../packages/mixin"
import { nobody, everybody, system } from "../packages/role"
import { Random } from "../packages/selection"
it("Selection flow", async function () {
    const selection_relation_model = model({
        name: "selection_relation_model",
        database: Store,
        schema: {
            field: {
                type: Text,
            },
        },
    })

    const r = await run({
        model: selection_relation_model,
        method: Create,
        body: {
            field: "as",
        },
    })

    const selection_test = await model({
        name: "selection_test",
        database: Store,
        schema: {
            field1: {
                relation: selection_relation_model,
                selection: Random,
            },
            field2: {
                relation: selection_relation_model,
                selection: Random,
            },
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
