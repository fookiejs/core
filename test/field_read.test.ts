import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"
it("read:['nobody'] -> empty field", async function () {
    let test_field_read = await model({
        name: "test_field_read",
        database: Database.Store,
        schema: {
            msg: {
                type: Type.Text,
                read: [Role.nobody],
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

    await run({
        model: test_field_read,
        method: Create,
        body: {
            msg: "hi",
        },
    })

    let read_res = await run({
        model: test_field_read,
        method: "read",
        query: {
            filter: {},
        },
    })

    assert.equal(read_res.data[0].msg, undefined)
})
