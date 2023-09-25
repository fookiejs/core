import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"

it("roles_test_token", async function () {
    const roles_system_model = await model({
        name: "roles_system_model",
        database: Database.Store,
        schema: {
            field: {
                type: Type.Text,
                required: true,
            },
        },
        bind: {
            create: {
                role: [Role.system],
            },
            read: {
                role: [Role.nobody],
            },
            update: {
                role: [Role.everybody],
            },
        },
    })

    const create_res = await run({
        model: roles_system_model,
        method: Create,
        body: {
            field: "hi",
        },
    })
    assert.equal(create_res.status, false)
    assert.equal(create_res.error, "system")

    const read_res = await run({
        model: roles_system_model,
        method: Read,
    })
    assert.equal(read_res.status, false)
    assert.equal(read_res.error, "nobody")

    const update_res = await run({
        model: roles_system_model,
        method: Update,
        query: {
            filter: {},
        },
        body: {
            field: "hello",
        },
    })

    assert.equal(update_res.status, true)
})

it("roles_test_token 2", async function () {
    const extra_role_reject_false = await model({
        name: "extra_role_reject_false",
        database: Database.Store,
        schema: {
            field: {
                type: Type.Text,
                required: true,
            },
        },
        bind: {
            read: {
                role: [Role.nobody],
                reject: {
                    nobody: {
                        rule: [Role.nobody],
                    },
                },
            },
        },
    })

    const res = await run({
        model: extra_role_reject_false,
        method: Read,
    })

    assert.equal(res.status, false)
})

it("roles_test_token 3", async function () {
    const extra_role_reject_true = await model({
        name: "extra_role_reject_true",
        database: Database.Store,
        schema: {
            field: {
                type: Type.Text,
                required: true,
            },
        },
        bind: {
            read: {
                role: [Role.nobody],
                reject: {
                    nobody: {
                        rule: [Role.everybody],
                    },
                },
            },
        },
    })

    const res = await run({
        model: extra_role_reject_true,
        method: Read,
    })

    assert.equal(res.status, true)
})
