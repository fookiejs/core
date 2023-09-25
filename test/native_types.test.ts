import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"

it("native types", async function () {
    const async_effect_model = await model({
        name: "async_effect_model",
        database: Database.Store,
        schema: {
            text: {
                type: Type.Text,
            },
            num: {
                type: Type.Integer,
            },
            obj: {
                type: Type.Plain,
            },
            arr: {
                type: Type.Array(Type.Integer),
            },
            bl: {
                type: Type.Boolean,
            },
            bf: {
                type: Type.Buffer,
            },
            ch: {
                type: Type.Char,
            },
            fn: {
                type: Type.Function,
            },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
        },
    })

    const res = await run({
        model: async_effect_model,
        method: Create,
        body: {
            text: "hi",
            num: 1,
            obj: { hi: 1 },
            arr: [1, 2, 3, 4],
            bl: false,
            bf: Buffer.alloc(10),
            ch: "a",
            fn: function () {},
        },
    })

    assert.equal(res?.status, true)
})
