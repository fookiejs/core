import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import { Random } from "../src/selections"
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
