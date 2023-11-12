import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("check auth 1", async function () {
    let child_setting = await Fookie.Builder.model({
        name: "child_setting",
        database: Fookie.Dictionary.Database.store,
        schema: {
            msg: {
                type: Fookie.Dictionary.Type.text,
            },
        },
        bind: {
            create: {
                role: [Fookie.Dictionary.Lifecycle.nobody],
            },
        },
    })

    let create_res = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: child_setting,
        method: Fookie.Method.Create,
        body: {
            msg: "hola",
        },
    })
    assert.equal(create_res.status, false)
})

it("check auth 2", async function () {
    const child_setting2 = await Fookie.Builder.model({
        name: "child_setting2",
        database: Fookie.Dictionary.Database.store,
        schema: {
            msg: {
                type: Fookie.Dictionary.Type.text,
            },
        },
        bind: {
            create: {
                role: [Fookie.Dictionary.Lifecycle.nobody],
            },
        },
    })

    let create_res_2 = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: child_setting2,
        method: Fookie.Method.Create,
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, false)
})

it(" check auth reject modify", async function () {
    let flag = false

    const test_r_modify = Fookie.Builder.lifecycle(async function (payload, state) {
        flag = true
    })
    const msg_reject_1 = await Fookie.Builder.model({
        name: "msg_reject_1",
        database: Fookie.Dictionary.Database.store,
        schema: {
            msg: {
                type: Fookie.Dictionary.Type.text,
            },
        },
        bind: {
            create: {
                role: [Fookie.Dictionary.Lifecycle.nobody],
                reject: {
                    nobody: {
                        modify: [test_r_modify],
                    },
                },
            },
        },
    })

    let create_res_2 = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: msg_reject_1,
        method: Fookie.Method.Create,
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, true)
    assert.equal(flag, true)
})

it(" check auth accept modify", async function () {
    let flag = false

    const test_a_modify = Fookie.Builder.lifecycle(async function (payload, state) {
        flag = true
    })

    const msg_accept_0 = await Fookie.Builder.model({
        name: "msg_accept_0",
        database: Fookie.Dictionary.Database.store,
        schema: {
            msg: {
                type: Fookie.Dictionary.Type.text,
            },
        },
        bind: {
            create: {
                role: [Fookie.Dictionary.Lifecycle.everybody],
                accept: {
                    everybody: {
                        modify: [test_a_modify],
                    },
                },
            },
        },
    })

    let create_res_2 = await Fookie.run({
        model: msg_accept_0,
        method: Fookie.Method.Create,
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, true)
    assert.equal(flag, true)
})

it(" check auth array", async function () {
    let flag = false

    const test_a_modify = Fookie.Builder.lifecycle(async function (payload, state) {
        flag = true
    })
    const msg_array = await Fookie.Builder.model({
        name: "msg_array",
        database: Fookie.Dictionary.Database.store,
        schema: {
            msg: {
                type: Fookie.Dictionary.Type.text,
            },
        },
        bind: {
            create: {
                role: [Fookie.Dictionary.Lifecycle.nobody, Fookie.Dictionary.Lifecycle.everybody],
            },
        },
    })

    let create_res_2 = await Fookie.run({
        model: msg_array,
        method: Fookie.Method.Create,
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, true)
})

it(" check auth field write", async function () {
    const caf_role = Fookie.Builder.lifecycle(async function (payload, state) {
        return false
    })

    const caf = await Fookie.Builder.model({
        name: "caf",
        database: Fookie.Dictionary.Database.store,
        schema: {
            msg: {
                type: Fookie.Dictionary.Type.text,
                write: [caf_role],
            },
        },
        bind: {
            create: {
                role: [],
            },
        },
    })

    let create_res_2 = await Fookie.run({
        model: caf,
        method: Fookie.Method.Create,
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, false)
})

it(" check auth field read", async function () {
    const car_role = Fookie.Builder.lifecycle(async function (payload, state) {
        return false
    })

    const car = await Fookie.Builder.model({
        name: "car",
        database: Fookie.Dictionary.Database.store,
        schema: {
            msg: {
                type: Fookie.Dictionary.Type.text,
                read: [car_role],
            },
        },
        bind: {
            create: {
                role: [Fookie.Dictionary.Lifecycle.everybody],
            },
        },
    })

    await Fookie.run({
        model: car,
        method: Fookie.Method.Create,
        body: {
            msg: "hola",
        },
    })

    let read_res = await Fookie.run<any, "read">({
        token: process.env.SYSTEM_TOKEN,
        model: car,
        method: Fookie.Method.Read,
    })

    for (const data of read_res.data) {
        if (data.msg) throw Error("errrr")
    }
})

it(" check auth reject rule", async function () {
    let flag = false

    const test_r_rule = Fookie.Builder.lifecycle(async function (payload, state) {
        flag = true
        return true
    })
    const msg_reject_2 = await Fookie.Builder.model({
        name: "msg_reject_2",
        database: Fookie.Dictionary.Database.store,
        schema: {
            msg: {
                type: Fookie.Dictionary.Type.text,
            },
        },
        bind: {
            create: {
                role: [Fookie.Dictionary.Lifecycle.nobody],
                reject: {
                    nobody: {
                        rule: [test_r_rule],
                    },
                },
            },
        },
    })

    let create_res_2 = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: msg_reject_2,
        method: Fookie.Method.Create,
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, true)
    assert.equal(flag, true)
})

it(" check auth accept rule", async function () {
    let flag = false

    const test_a_rule = Fookie.Builder.lifecycle(async function (payload, state) {
        flag = true
        return false
    })

    const msg_accept_1 = await Fookie.Builder.model({
        name: "msg_accept_1",
        database: Fookie.Dictionary.Database.store,
        schema: {
            msg: {
                type: Fookie.Dictionary.Type.text,
            },
        },
        bind: {
            create: {
                role: [Fookie.Dictionary.Lifecycle.everybody],
                accept: {
                    everybody: {
                        rule: [test_a_rule],
                    },
                },
            },
        },
    })

    let create_res_2 = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: msg_accept_1,
        method: Fookie.Method.Create,
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, false)
    assert.equal(flag, true)
})

it(" check auth reject rule 2", async function () {
    const test_a_rule_3 = Fookie.Builder.lifecycle(async function (payload, state) {
        return false
    })

    const msg_reject_3 = await Fookie.Builder.model({
        name: "msg_reject_3",
        database: Fookie.Dictionary.Database.store,
        schema: {
            msg: {
                type: Fookie.Dictionary.Type.text,
            },
        },
        bind: {
            create: {
                role: [Fookie.Dictionary.Lifecycle.nobody, Fookie.Dictionary.Lifecycle.everybody],
                reject: {
                    nobody: {
                        rule: [test_a_rule_3],
                    },
                },
            },
        },
    })

    let create_res_2 = await Fookie.run({
        token: process.env.SYSTEM_TOKEN,
        model: msg_reject_3,
        method: Fookie.Method.Create,
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, false)
})
