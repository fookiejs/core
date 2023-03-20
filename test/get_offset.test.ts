import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"
import { nobody, everybody, system } from "@fookie/role"

it("get offset", async function () {
    @Model({ database: Store })
    class OffsetModel {
        @Field({ type: Text, required: true })
        name: string
    }

    const size = 10
    const offset = 3
    for (let i = 0; i < size; i++) {
        await run({
            token: process.env.SYSTEM_TOKEN,
            model: OffsetModel,
            method: Create,
            body: {
                name: "offset",
            },
        })
    }
    let res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: OffsetModel,
        method: Read,
        query: {
            offset: offset,
            attributes: ["name"],
        },
    })

    assert.equal(res.data.length, size - offset)
})
