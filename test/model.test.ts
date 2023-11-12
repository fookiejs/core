import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

import { Dictionary } from "../packages/dictionary"

describe("fookie", async function () {
    it("Decorators", async function () {
        const user = await Fookie.Builder.model({
            name: "user",
            database: Fookie.Dictionary.Database.store,
            schema: {
                name: { type: Fookie.Dictionary.Type.text, required: true },
                password: { type: Fookie.Dictionary.Type.text, required: true },
            },
        })

        const res = await Fookie.run({
            model: user,
            method: Fookie.Method.Create,
            body: {
                name: "umut",
                password: "umut",
            },
        })

        const user_model = lodash.find(lodash.values(Dictionary.Model), { name: "user" })
        assert.equal(lodash.isObject(user_model), true)
    })

    it("Model create", async function () {
        await Fookie.Builder.model({
            name: "account",
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
            },
        })

        const account = lodash.find(lodash.values(Dictionary.Model), { name: "account" })
        assert.equal(lodash.isObject(account), true)
    })
})
