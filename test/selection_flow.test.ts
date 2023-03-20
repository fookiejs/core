import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"
import { nobody, everybody, system } from "@fookie/role"

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
