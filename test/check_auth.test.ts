import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("check auth", async function () {
    // PHASE 1
    let model_res = model({
        name: "child_setting",
        database: Store,
        schema: {
            msg: {
                type: Text,
            },
        },
        bind: {
            create: {
                role: ["nobody"],
            },
        },
    })

    let create_res = await run({
        model: "child_setting",
        method: "create",
        body: {
            msg: "hola",
        },
    })
    assert.equal(create_res.status, false)

    // PHASE 2

    let model_res_2 = model({
        name: "child_setting2",
        database: Store,
        schema: {
            msg: {
                type: Text,
            },
        },
        bind: {
            create: {
                role: ["nobody"],
            },
        },
    })

    let create_res_2 = await run({
        model: "child_setting2",
        method: "create",
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, false)
})

it(" check auth reject modify", async function () {
    let flag = false

    await lifecycle({
        name: "test_r_modify",
        function: async function (payload, ctx, state) {
            flag = true
        },
    })
    const model_res = model({
        name: "msg_reject_1",
        database: Store,
        schema: {
            msg: {
                type: Text,
            },
        },
        bind: {
            create: {
                role: ["nobody"],
                reject: {
                    nobody: {
                        modify: ["test_r_modify"],
                    },
                },
            },
        },
    })

    let create_res_2 = await run({
        model: "msg_reject_1",
        method: "create",
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, true)
    assert.equal(flag, true)
})

it(" check auth accept modify", async function () {
    let flag = false

    await fookie.lifecycle({
        name: "test_a_modify",
        function: async function (payload, ctx, state) {
            flag = true
        },
    })
    model({
        name: "msg_accept_0",
        database: Store,
        schema: {
            msg: {
                type: Text,
            },
        },
        bind: {
            create: {
                role: ["everybody"],
                accept: {
                    everybody: {
                        modify: ["test_a_modify"],
                    },
                },
            },
        },
    })

    let create_res_2 = await run({
        model: "msg_accept_0",
        method: "create",
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, true)
    assert.equal(flag, true)
})

it(" check auth array", async function () {
    let flag = false

    await fookie.lifecycle({
        name: "test_a_modify",
        function: async function (payload, ctx, state) {
            flag = true
        },
    })
    model({
        name: "msg_array",
        database: Store,
        schema: {
            msg: {
                type: Text,
            },
        },
        bind: {
            create: {
                role: ["nobody", "everybody"],
            },
        },
    })

    let create_res_2 = await run({
        model: "msg_array",
        method: "create",
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, true)
})

it(" check auth field write", async function () {
    await fookie.lifecycle({
        name: "caf_role",
        function: async function (payload, ctx, state) {
            return false
        },
    })

    model({
        name: "caf",
        database: Store,
        schema: {
            msg: {
                type: Text,
                write: ["caf_role"],
            },
        },
        bind: {
            create: {
                role: [],
            },
        },
    })

    let create_res_2 = await run({
        model: "caf",
        method: "create",
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, false)
})

it(" check auth field read", async function () {
    await fookie.lifecycle({
        name: "car_role",
        function: async function (payload, ctx, state) {
            return false
        },
    })

    model({
        name: "car",
        database: Store,
        schema: {
            msg: {
                type: Text,
                read: ["car_role"],
            },
        },
        bind: {
            create: {
                role: ["everybody"],
            },
        },
    })

    await run({
        model: "car",
        method: "create",
        body: {
            msg: "hola",
        },
    })

    let read_res = await run({
        model: "car",
        method: "read",
        body: {
            msg: "hola",
        },
    })

    for (const data of read_res.data) {
        if (data.msg) throw Error("errrr")
    }
})

it(" check auth reject rule", async function () {
    let flag = false

    await fookie.lifecycle({
        name: "test_r_rule",
        function: async function (payload, ctx, state) {
            flag = true
            return true
        },
    })
    const model_res = model({
        name: "msg_reject_2",
        database: Store,
        schema: {
            msg: {
                type: Text,
            },
        },
        bind: {
            create: {
                role: ["nobody"],
                reject: {
                    nobody: {
                        rule: ["test_r_rule"],
                    },
                },
            },
        },
    })

    let create_res_2 = await run({
        model: "msg_reject_2",
        method: "create",
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, true)
    assert.equal(flag, true)
})

it(" check auth accept rule", async function () {
    let flag = false

    await fookie.lifecycle({
        name: "test_a_rule",
        function: async function (payload, ctx, state) {
            flag = true
            return false
        },
    })
    model({
        name: "msg_accept_1",
        database: Store,
        schema: {
            msg: {
                type: Text,
            },
        },
        bind: {
            create: {
                role: ["everybody"],
                accept: {
                    everybody: {
                        rule: ["test_a_rule"],
                    },
                },
            },
        },
    })

    let create_res_2 = await run({
        model: "msg_accept_1",
        method: "create",
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, false)
    assert.equal(flag, true)
})

it(" check auth reject rule 2", async function () {
    await fookie.lifecycle({
        name: "test_a_rule_3",
        function: async function (payload, ctx, state) {
            return false
        },
    })
    model({
        name: "msg_reject_3",
        database: Store,
        schema: {
            msg: {
                type: Text,
            },
        },
        bind: {
            create: {
                role: ["nobody", "everybody"],
                reject: {
                    nobody: {
                        rule: ["test_a_rule_3"],
                    },
                },
            },
        },
    })

    let create_res_2 = await run({
        model: "msg_reject_3",
        method: "create",
        body: {
            msg: "hola",
        },
    })

    assert.equal(create_res_2.status, true)
})

it(" check auth missing_1", async function () {
    model({
        name: "msg_missing_lsf_1",
        database: Store,
        schema: {
            msg: {
                type: Text,
            },
        },
        bind: {
            create: {
                role: ["nobody"],
                reject: {
                    nobody: {
                        rule: ["not_existed_lfs"],
                    },
                },
            },
        },
    })

    try {
        await run({
            model: "msg_missing_lsf_1",
            method: "create",
            body: {
                msg: "hola",
            },
        })
        throw Error("-")
    } catch (error) {}
})
it(" check auth missing_2", async function () {
    model({
        name: "msg_missing_lsf_2",
        database: Store,
        schema: {
            msg: {
                type: Text,
            },
        },
        bind: {
            create: {
                role: ["nobody"],
                reject: {
                    nobody: {
                        modify: ["not_existed_lfs"],
                    },
                },
            },
        },
    })

    try {
        await run({
            model: "msg_missing_lsf_2",
            method: "create",
            body: {
                msg: "hola",
            },
        })
        throw Error("-")
    } catch (error) {}
})
it(" check auth missing_3", async function () {
    model({
        name: "msg_missing_lsf_3",
        database: Store,
        schema: {
            msg: {
                type: Text,
            },
        },
        bind: {
            create: {
                role: ["everybody"],
                accept: {
                    everybody: {
                        modify: ["not_existed_lfdsds"],
                    },
                },
            },
        },
    })

    try {
        await run({
            model: "msg_missing_lsf_3",
            method: "create",
            body: {
                msg: "hola",
            },
        })

        throw Error("-")
    } catch (error) {}
})
it(" check auth missing_4", async function () {
    model({
        name: "msg_missing_lsf_4",
        database: Store,
        schema: {
            msg: {
                type: Text,
            },
        },
        bind: {
            create: {
                role: ["everybody"],
                accept: {
                    everybody: {
                        rule: ["not_existed_lfdss"],
                    },
                },
            },
        },
    })

    try {
        await run({
            model: "msg_missing_lsf_4",
            method: "create",
            body: {
                msg: "hola",
            },
        })
        throw Error("-")
    } catch (error) {}
})
