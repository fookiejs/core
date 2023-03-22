import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { mixin } from "../packages/mixin"

it("Attributes", async function () {
    @Model({ database: Store })
    class ClassModelAttributes {
        @Field({ type: Text, required: true })
        field1: string
        @Field({ type: Text, required: true })
        field2: string
        @Field({ type: Text, required: true })
        field3: string
        @Field({ type: Text, required: true })
        field4: string
        @Field({ type: Text, required: true })
        field5: string
    }

    await run({
        model: ClassModelAttributes,
        method: Create,
        body: {
            field1: "abc",
            field2: "abc",
            field3: "abc",
            field4: "abc",
            field5: "abc",
        },
    })

    const response = await run({
        model: ClassModelAttributes,
        method: Read,
        query: {
            attributes: ["field1", "field4"],
        },
    })

    assert.equal(response.status, true)

    assert.deepEqual(lodash.omit(response.data[0], ["field1", "field4", "id"]), {})
})
