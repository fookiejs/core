import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("roles_test_token", async function () {
    const roles_system_model = await Fookie.Builder.model({
        name: "roles_system_model",
        database: Fookie.Dictionary.Database.store,
        schema: {
            field: {
                type: Fookie.Dictionary.Type.text,
                required: true,
            },
        },
        bind: {
            create: {
                role: [Fookie.Dictionary.Lifecycle.system],
            },
            read: {
                role: [Fookie.Dictionary.Lifecycle.nobody],
            },
            update: {
                role: [Fookie.Dictionary.Lifecycle.everybody],
            },
        },
    })

    const create_res = await Fookie.run({
        model: roles_system_model,
        method: Fookie.Method.Create,
        body: {
            field: "hi",
        },
    })
    assert.equal(create_res.status, false)
    assert.equal(create_res.error, "system")

    const read_res = await Fookie.run({
        model: roles_system_model,
        method: Fookie.Method.Read,
    })
    assert.equal(read_res.status, false)
    assert.equal(read_res.error, "nobody")

    const update_res = await Fookie.run({
        model: roles_system_model,
        method: Fookie.Method.Update,
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
    const extra_role_reject_false = await Fookie.Builder.model({
        name: "extra_role_reject_false",
        database: Fookie.Dictionary.Database.store,
        schema: {
            field: {
                type: Fookie.Dictionary.Type.text,
                required: true,
            },
        },
        bind: {
            read: {
                role: [Fookie.Dictionary.Lifecycle.nobody],
                reject: {
                    nobody: {
                        rule: [Fookie.Dictionary.Lifecycle.nobody],
                    },
                },
            },
        },
    })

    const res = await Fookie.run({
        model: extra_role_reject_false,
        method: Fookie.Method.Read,
    })

    assert.equal(res.status, false)
})

it("roles_test_token 3", async function () {
    const extra_role_reject_true = await Fookie.Builder.model({
        name: "extra_role_reject_true",
        database: Fookie.Dictionary.Database.store,
        schema: {
            field: {
                type: Fookie.Dictionary.Type.text,
                required: true,
            },
        },
        bind: {
            read: {
                role: [Fookie.Dictionary.Lifecycle.nobody],
                reject: {
                    nobody: {
                        rule: [Fookie.Dictionary.Lifecycle.everybody],
                    },
                },
            },
        },
    })

    const res = await Fookie.run({
        model: extra_role_reject_true,
        method: Fookie.Method.Read,
    })

    assert.equal(res.status, true)
})
