import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import {
    Text as t,
    Integer as n,
    Array as a,
    Boolean as b,
    Buffer as bu,
    Char as ch,
    Function as f,
    Plain as o,
} from "../packages/type"
import { After, Before } from "../packages/mixin"
import { nobody, everybody, system } from "../packages/role"

it("native types", async function () {
    await model({
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
