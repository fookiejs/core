import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

describe("fookie", async function () {
    it("Class model read", async function () {
        const ClassModelToRead = await Fookie.Builder.model({
            name: "ClassModelToRead",
            database: Fookie.Dictionary.Database.store,
            schema: {
                name: { type: Fookie.Dictionary.Type.text, required: true },
            },
            bind: {
                test: {},
                create: {},
                delete: {},
                read: {},
                count: {},
            },
        })

        const response = await Fookie.run({
            model: ClassModelToRead,
            method: Fookie.Method.Read,
        })

        assert.equal(lodash.isArray(response.data), true)
    })

    it("Object model read", async function () {
        const object_model = await Fookie.Builder.model({
            name: "object_model_to_read",
            database: Fookie.Dictionary.Database.store,
            schema: {
                name: {
                    type: Fookie.Dictionary.Type.text,
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
        const response = await Fookie.run({
            model: object_model,
            method: Fookie.Method.Read,
        })
        assert.equal(lodash.isArray(response.data), true)
    })
})
