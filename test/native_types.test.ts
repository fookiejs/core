import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import {
    Text as t,
    Number as n,
    Plain as o,
    Array as a,
    Boolean as b,
    Buffer as bu,
    Char as ch,
    Function as f,
} from "../src/types"
import * as lodash from "lodash"

it("native types", async function () {
    model({
        name: "async_effect_model",
        database: Store,
        schema: {
            text: {
                type: t,
            },
            num: {
                type: n,
            },
            obj: {
                type: o,
            },
            arr: {
                type: a,
            },
            bl: {
                type: b,
            },
            bf: {
                type: bu,
            },
            ch: {
                type: ch,
            },
            fn: {
                type: f,
            },
        },
    })

    const res = await run({
        model: "async_effect_model",
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

    assert.equal(res.status, true)
})
