import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("Filters with object", async function () {
    await fookie.init()
    const res = model({
        name: "number",
        database: Store,
        schema: {
            val: {
                type: "number",
                required: true,
            },
            val_str: {
                type: Text,
                required: true,
            },
        },
    })
    for (let i = 0; i < 10000; i++) {
        await run({
            token: "system_token",
            model: "number",
            method: "create",
            body: {
                val: Math.round(Math.random() * 1000),
                val_str: Math.round(Math.random() * 1000) + "umudik",
            },
        })
    }

    // QUERIES

    const gte_res = await run({
        token: "system_token",
        method: "read",
        model: "number",
        query: {
            filter: {
                val: {
                    $gte: 300,
                },
            },
        },
    })
    for (let entity of gte_res.data) {
        if (entity.val < 300) throw Error("gte" + entity.val)
    }

    const lte_res = await run({
        token: "system_token",
        method: "read",
        model: "number",
        query: {
            filter: {
                val: {
                    $lte: 500,
                },
            },
        },
    })
    for (let entity of lte_res.data) {
        if (entity.val > 500) throw Error("lte")
    }

    const gt_res = await run({
        token: "system_token",
        method: "read",
        model: "number",
        query: {
            filter: {
                val: {
                    $gt: 300,
                },
            },
        },
    })
    for (let entity of gt_res.data) {
        if (entity.val <= 300) throw Error("gte")
    }

    const lt_res = await run({
        token: "system_token",
        method: "read",
        model: "number",
        query: {
            filter: {
                val: {
                    $lt: 500,
                },
            },
        },
    })
    for (let entity of lt_res.data) {
        if (entity.val >= 500) throw Error("lte")
    }

    const eq_r = await run({
        token: "system_token",
        method: "read",
        model: "number",
        query: {
            filter: {
                val: {
                    $eq: 250,
                },
            },
        },
    })
    for (let entity of eq_r.data) {
        if (entity.val !== 250) throw Error("eq")
    }

    const ne_r = await run({
        token: "system_token",
        method: "read",
        model: "number",
        query: {
            filter: {
                val: {
                    $ne: 350,
                },
            },
        },
    })
    for (let entity of ne_r.data) {
        if (entity.val === 350) throw Error("eq")
    }

    const inc_r = await run({
        token: "system_token",
        method: "read",
        model: "number",
        query: {
            filter: {
                val_str: {
                    $inc: "12",
                },
            },
        },
    })
    for (let entity of inc_r.data) {
        if (!lodash.includes(entity.val_str, "12")) throw Error("inc")
    }

    const invalid_r = await run({
        token: "system_token",
        method: "read",
        model: "number",
        query: {
            filter: {
                val_str: {
                    $INVALID: "12",
                },
            },
        },
    })
    assert.equal(invalid_r.status, false)

    const accepted_query_field_keys = fookie.local.get("setting", "accepted_query_field_keys")
    accepted_query_field_keys.value.keys.push("$INVALID")
    fookie.local.set("setting", accepted_query_field_keys)
    const invalid_r_2 = await run({
        token: "system_token",
        method: "read",
        model: "number",
        query: {
            filter: {
                val_str: {
                    $INVALID: "12",
                },
            },
        },
    })
    assert.equal(invalid_r_2.status, true)
})
