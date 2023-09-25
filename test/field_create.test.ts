import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"

it("create:['nobody'] -> empty field", async function () {
    let test_field_create = await model({
        name: "test_field_create",
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

    let create_res = await run({
        model: test_field_create,
        method: Create,
        body: {
            msg: "hi",
        },
    })
    assert.equal(create_res.data.msg, undefined)
})
