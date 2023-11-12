import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

describe("fookie", async function () {
    it("Class model read", async function () {
        const ClassModelToRead = await model({
            name: "ClassModelToRead",
            database: Database.Store,
            schema: {
                name: { type: Type.Text, required: true },
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
            database: Database.Store,
            schema: {
                name: {
                    type: Type.Text,
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
