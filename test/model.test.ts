import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { After, Before } from "../packages/mixin"

describe("fookie", async function () {
    it("Decorators", async function () {
        const user = await model({
            name: "user",
            database: Store,
            schema: {
                name: { type: Text, required: true },
                password: { type: Text, required: true },
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

        const user_model = lodash.find(models, { name: "user" })
        assert.equal(lodash.isObject(user_model), true)
    })

    it("Model create", async function () {
        await model({
            name: "account",
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

        const account = lodash.find(models, { name: "account" })
        assert.equal(lodash.isObject(account), true)
    })
})
