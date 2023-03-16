import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Delete, Read, Count } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("Create model", async function () {
    @Model({ database: Store })
    class CascadeDeleteParent {
        @Field({ type: Text, required: true })
        name: string
    }

    @Model({ database: Store })
    class CascadeDeleteChild {
        @Field({ type: Text, required: true, relation: CascadeDeleteParent })
        parent: number
    }

    const parent = (
        await run({
            model: CascadeDeleteParent,
            method: Create,
            body: {
                name: "parent_1",
            },
        })
    ).data

    for (let i = 0; i < 10; i++) {
        await run({
            model: CascadeDeleteChild,
            method: Create,
            body: {
                parent: parent.id,
            },
        })
    }

    await run({
        model: CascadeDeleteParent,
        method: Delete,
        query: {
            filter: {
                name: "parent_1",
            },
        },
    })

    let count = (
        await run({
            model: CascadeDeleteChild,
            method: Count,
            query: {
                filter: {},
            },
        })
    ).data

    assert.equal(count, 0)
})
