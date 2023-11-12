import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("Filters with object", async function () {
    const FiterObject = await model({
        name: "FiterObject",
        database: Database.Store,
        schema: {
            val: {
                type: Type.Integer,
                required: true,
            },
            val_str: {
                type: Type.Text,
                required: true,
            },
        },
        bind: {
            test: {},
            create: {},
            delete: {},
            read: {},
            count: {},
            sum: {},
        },
    })

    for (let i = 0; i < 100; i++) {
        await run({
            model: FiterObject,
            method: Create,
            body: {
                val: Math.round(Math.random() * 1000),
                val_str: Math.round(Math.random() * 1000) + "umudik",
            },
        })

        await run({
            model: FiterObject,
            method: Create,
            body: {
                val: 50,
                val_str: "50_umudik",
            },
        })
        await run({
            model: FiterObject,
            method: Create,
            body: {
                val: 250,
                val_str: "50_umudik",
            },
        })
    }

    // QUERIES

    const gte_res = await run({
        method: Read,
        model: FiterObject,
        query: {
            filter: {
                val: {
                    gte: 300,
                },
            },
        },
    })
    for (let entity of gte_res.data) {
        if (entity.val < 300) throw Error("gte" + entity.val)
    }

    const lte_res = await run({
        method: Read,
        model: FiterObject,
        query: {
            filter: {
                val: {
                    lte: 300,
                },
            },
        },
    })

    for (let entity of lte_res.data) {
        if (entity.val > 500) throw Error("lte")
    }

    const gt_res = await run({
        method: Read,
        model: FiterObject,
        query: {
            filter: {
                val: {
                    gt: 300,
                },
            },
        },
    })
    for (let entity of gt_res.data) {
        if (entity.val <= 300) throw Error("gte")
    }

    const lt_res = await run({
        method: Read,
        model: FiterObject,
        query: {
            filter: {
                val: {
                    lt: 500,
                },
            },
        },
    })

    for (let entity of lt_res.data) {
        if (entity.val >= 500) throw Error("lte")
    }

    const eq_r = await run({
        method: Read,
        model: FiterObject,
        query: {
            filter: {
                val: {
                    eq: 250,
                },
            },
        },
    })
    for (let entity of eq_r.data) {
        if (entity.val !== 250) throw Error("eq")
    }

    const ne_r = await run({
        method: Read,
        model: FiterObject,
        query: {
            filter: {
                val: {
                    not: 50,
                },
            },
        },
    })

    for (let entity of ne_r.data) {
        if (entity.val === 50) throw Error("eq")
    }

    const inc_r = await run({
        method: Read,
        model: FiterObject,
        query: {
            filter: {
                val_str: {
                    inc: "12",
                },
            },
        },
    })
    for (let entity of inc_r.data) {
        if (!lodash.includes(entity.val_str, "12")) throw Error("inc")
    }
})
