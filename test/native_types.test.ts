import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("native types", async function () {
    const async_effect_model = await Fookie.Builder.model({
        name: "async_effect_model",
        database: Fookie.Dictionary.Database.store,
        schema: {
            text: {
                type: Fookie.Dictionary.Type.text,
            },
            num: {
                type: Fookie.Dictionary.Type.integer,
            },
            obj: {
                type: Fookie.Dictionary.Type.plain,
            },
            arr: {
                type: Fookie.Dictionary.Type.array(Fookie.Dictionary.Type.integer),
            },
            bl: {
                type: Fookie.Dictionary.Type.boolean,
            },
            bf: {
                type: Fookie.Dictionary.Type.buffer,
            },
            ch: {
                type: Fookie.Dictionary.Type.char,
            },
            fn: {
                type: Fookie.Dictionary.Type.func,
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

    const res = await Fookie.run({
        model: async_effect_model,
        method: Fookie.Method.Create,
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
