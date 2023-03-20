import { it, describe, assert } from "vitest"
import { model, run, models } from "../index"
import { Store } from "../packages/databases"
import { Model, Field } from "../packages/decorators"
import { Create, Read } from "../packages/methods"
import { Text, Number } from "../packages/types"
import * as lodash from "lodash"

describe("fookie", async function () {
    it("Decorators", async function () {
        @Model({ database: Store })
        class User {
            @Field({ type: Text, required: true })
            name: string

            @Field({ type: Text, required: true })
            password: string
        }

        const res = await run({
            model: User,
            method: Create,
            body: {
                name: "umut",
                password: "umut",
            },
        })

        const user = lodash.find(models, { name: "user" })
        assert.equal(lodash.isObject(user), true)
    })

    it("Model create", async function () {
        model({
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
