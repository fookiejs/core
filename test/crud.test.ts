import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store, database } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain, type } from "../packages/type"
import { mixin, After, Before } from "../packages/mixin"

describe("fookie", async function () {
    it("Class model read", async function () {
        const ClassModelToRead = await model({
            name: "ClassModelToRead",
            database: Store,
            schema: {
                name: { type: Text, required: true },
            },
            bind: {
                test: {},
                create: {},
                delete: {},
                read: {},
                count: {},
            },
        })

        const response = await run({
            model: ClassModelToRead,
            method: Read,
        })

        assert.equal(lodash.isArray(response.data), true)
    })

    it("Object model read", async function () {
        const object_model = await model({
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
                read: {},
            },
        })
        const response = await run({
            model: object_model,
            method: Read,
        })
        assert.equal(lodash.isArray(response.data), true)
    })
})
