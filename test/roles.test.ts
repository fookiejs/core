import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read, Update } from "../src/methods"
import { Text, Number } from "../src/types"
import { nobody, everybody, system } from "../src/roles"
import * as lodash from "lodash"

it("roles_test_token", async function () {
    const roles_system_model = model({
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
    const extra_role_reject_false = model({
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
    const extra_role_reject_true = model({
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
