import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("valid query", async function () {
    const res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "model",
        method: "read",
        query: {
            filter: undefined,
        },
    })
    assert.equal(res.status, false)
    assert.equal(res.error, "valid_query")
})

it("valid query", async function () {
    const res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "model",
        method: "read",
        query: {
            filter: {
                limit: "hi",
            },
        },
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "valid_query")
})

it("valid query", async function () {
    const res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "model",
        method: "read",
        query: {
            offset: "hi",
        },
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "valid_query")
})

it("valid query", async function () {
    const res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "model",
        method: "read",
        query: {
            limit: "hi",
        },
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "valid_query")
})

it("valid query", async function () {
    const res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: "model",
        method: "read",
        query: {
            filter: {
                hi: 1,
            },
        },
    })

    assert.equal(res.status, false)
    assert.equal(res.error, "valid_query")
})

it("valid query", async function () {
    model({
        name: "nmbr",
        database: Store,
        schema: {
            field: {
                type: "number",
            },
        },
    })

    const r1 = await run({
        model: "nmbr",
        method: "read",
        query: {
            filter: {
                field: {
                    $gte: "hi",
                },
            },
        },
    })
    assert.equal(r1.status, false)
    assert.equal(r1.error, "valid_query")

    const r2 = await run({
        model: "nmbr",
        method: "read",
        query: {
            filter: {
                field: {
                    $lte: "hi",
                },
            },
        },
    })
    assert.equal(r2.status, false)
    assert.equal(r2.error, "valid_query")

    const r3 = await run({
        model: "nmbr",
        method: "read",
        query: {
            filter: {
                field: {
                    $lte: "hi",
                },
            },
        },
    })
    assert.equal(r3.status, false)
    assert.equal(r3.error, "valid_query")

    const r4 = await run({
        model: "nmbr",
        method: "read",
        query: {
            filter: {
                field: {
                    $gt: "hi",
                },
            },
        },
    })
    assert.equal(r4.status, false)
    assert.equal(r4.error, "valid_query")

    const r5 = await run({
        model: "nmbr",
        method: "read",
        query: {
            filter: {
                field: {
                    $lt: "hi",
                },
            },
        },
    })
    assert.equal(r5.status, false)
    assert.equal(r5.error, "valid_query")

    const r6 = await run({
        model: "nmbr",
        method: "read",
        query: {
            filter: {
                field: {
                    $inc: 111,
                },
            },
        },
    })
    assert.equal(r6.status, false)
    assert.equal(r6.error, "valid_query")

    const r7 = await run({
        model: "nmbr",
        method: "read",
        query: {
            filter: {
                field: {
                    $or: "hi",
                },
            },
        },
    })
    assert.equal(r7.status, false)
    assert.equal(r7.error, "valid_query")

    const r8 = await run({
        model: "nmbr",
        method: "read",
        query: {
            filter: {
                field: {
                    $nor: "hi",
                },
            },
        },
    })
    assert.equal(r8.status, false)
    assert.equal(r8.error, "valid_query")
})
