import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "@fookie/core"
import { Store, database } from "@fookie/database"
import { Model, Field } from "@fookie/decorator"
import { Create, Read, Count, Delete, Test, Update } from "@fookie/method"
import {
    Text as t,
    Number as n,
    Array as a,
    Boolean as b,
    Buffer as bu,
    Char as ch,
    Function as f,
    Plain as o,
} from "@fookie/type"
import { mixin, After, Before } from "@fookie/mixin"
import { nobody, everybody, system } from "@fookie/role"

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
