import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Delete, Read, Count } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

it("cascade delete", async function () {
    @Model({ database: Store })
    class CascadeDeleteParent {
        @Field({ type: Text, required: true })
        name: string
    }

    @Model({ database: Store })
    class CascadeDeleteChild {
        @Field({ type: Text, relation: CascadeDeleteParent, cascade_delete: true })
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
