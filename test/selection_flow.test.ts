import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import { Random } from "../packages/selections"
import * as lodash from "lodash"

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
