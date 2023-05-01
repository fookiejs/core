import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store, database } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { mixin, After, Before } from "../packages/mixin"
import { nobody, everybody, system } from "../packages/role"

it("roles_test_token", async function () {
    const roles_system_model = await model({
        name: "roles_system_model",
        database: Store,
        schema: {
            field: {
                type: Text,
                required: true,
            },
        },
        bind: {
            create: {
                role: [system],
            },
            read: {
                role: [nobody],
            },
            update: {
                role: [everybody],
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
        database: Store,
        schema: {
            field: {
                type: Text,
                required: true,
            },
        },
        bind: {
            read: {
                role: [nobody],
                reject: {
                    nobody: {
                        rule: [nobody],
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
        database: Store,
        schema: {
            field: {
                type: Text,
                required: true,
            },
        },
        bind: {
            read: {
                role: [nobody],
                reject: {
                    nobody: {
                        rule: [everybody],
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
