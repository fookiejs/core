import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"
import Dictionary from "../packages/dictionary"

describe("fookie", async function () {
    it("Decorators", async function () {
        const user = await model({
            name: "user",
            database: Database.Store,
            schema: {
                name: { type: Type.Text, required: true },
                password: { type: Type.Text, required: true },
            },
        })

        const res = await run({
            model: user,
            method: Create,
            body: {
                name: "umut",
                password: "umut",
            },
        })

        const user_model = lodash.find(lodash.values(Dictionary.Model), { name: "user" })
        assert.equal(lodash.isObject(user_model), true)
    })

    it("Model create", async function () {
        await model({
            name: "account",
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
            },
        })

        const account = lodash.find(lodash.values(Dictionary.Model), { name: "account" })
        assert.equal(lodash.isObject(account), true)
    })
})
