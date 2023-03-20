import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

describe("fookie", async function () {
    it("Class model read", async function () {
        @Model({ database: Store })
        class ClassModelToRead {
            @Field({ type: Text, required: true })
            name: string
        }

        const response = await run({
            model: ClassModelToRead,
            method: Read,
        })

        assert.equal(lodash.isArray(response.data), true)
    })

    it("Object model read", async function () {
        const object_model = model({
            name: "object_model_to_read",
            database: Store,
            schema: {
                name: {
                    type: Text,
                    required: true,
                },
            },
            bind: {
                create: {
                    effect: [],
                    accept: {
                        everybody: {
                            modify: [],
                            rule: [],
                        },
                    },
                },
            },
        })
        const response = await run({
            model: object_model,
            method: Read,
        })
        assert.equal(lodash.isArray(response.data), true)
    })
})
