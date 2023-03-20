import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"

it("Drop", async function () {
    @Model({ database: Store })
    class DropModel {
        @Field({ type: Text, required: true })
        name: string
    }
    await run({
        model: DropModel,
        method: Create,
        body: {
            name: "test_1",
        },
        options: {
            drop: 1,
        },
    })

    await new Promise((resolve) => setTimeout(resolve, 20))

    setTimeout(async () => {
        let res = await run({
            model: DropModel,
            method: Read,
        })

        assert.equal(res.data.length, 0)
    }, 20)
})
