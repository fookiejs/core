import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

import Selection from "../packages/selection"

describe("validate_query", async function () {
    const InvalidQueryModel = await model({
        name: "InvalidQueryModel",
        database: Database.Store,
        schema: {
            field: { type: Type.Text, required: true },
            field2: { type: Type.Text, required: true },
        },
        bind: {
            read: {},
        },
    })

    it("valid query", async function () {
        const res = await run({
            model: InvalidQueryModel,
            method: Read,
            query: {
                filter: undefined,
            },
        })

        assert.equal(res.status, false)
        assert.equal(res.error, "validate_query")
    })

    it("valid query", async function () {
        const res = await run({
            model: InvalidQueryModel,
            method: Read,
            query: {
                filter: {
                    limit: "hi",
                },
            },
        })

        assert.equal(res.status, false)
        assert.equal(res.error, "validate_query")
    })

    it("valid query", async function () {
        const res = await run({
            model: InvalidQueryModel,
            method: Read,
            query: {
                offset: "hi",
            },
        })

        assert.equal(res.status, false)
        assert.equal(res.error, "validate_query")
    })

    it("valid query", async function () {
        const res = await run({
            model: InvalidQueryModel,
            method: Read,
            query: {
                limit: "hi",
            },
        })

        assert.equal(res.status, false)
        assert.equal(res.error, "validate_query")
    })

    it("valid query", async function () {
        const res = await run({
            model: InvalidQueryModel,
            method: Read,
            query: {
                filter: {
                    hi: 1,
                },
            },
        })

        assert.equal(res.status, false)
        assert.equal(res.error, "validate_query")
    })

    it("valid query", async function () {
        const r1 = await run({
            model: InvalidQueryModel,
            method: Read,
            query: {
                filter: {
                    field: {
                        gte: "hi",
                    },
                },
            },
        })

        assert.equal(r1.status, false)
        assert.equal(r1.error, "validate_query")

        const r2 = await run({
            model: InvalidQueryModel,
            method: Read,
            query: {
                filter: {
                    field: {
                        lte: "hi",
                    },
                },
            },
        })

        assert.equal(r2.status, false)
        assert.equal(r2.error, "validate_query")

        const r3 = await run({
            model: InvalidQueryModel,
            method: Read,
            query: {
                filter: {
                    field: {
                        lte: "hi",
                    },
                },
            },
        })
        assert.equal(r3.status, false)
        assert.equal(r3.error, "validate_query")

        const r4 = await run({
            model: InvalidQueryModel,
            method: Read,
            query: {
                filter: {
                    field: {
                        gt: "hi",
                    },
                },
            },
        })
        assert.equal(r4.status, false)
        assert.equal(r4.error, "validate_query")

        const r5 = await run({
            model: InvalidQueryModel,
            method: Read,
            query: {
                filter: {
                    field: {
                        lt: "hi",
                    },
                },
            },
        })
        assert.equal(r5.status, false)
        assert.equal(r5.error, "validate_query")

        const r6 = await run({
            model: InvalidQueryModel,
            method: Read,
            query: {
                filter: {
                    field: {
                        inc: 111,
                    },
                },
            },
        })
        assert.equal(r6.status, false)
        assert.equal(r6.error, "validate_query")

        const r7 = await run({
            model: InvalidQueryModel,
            method: Read,
            query: {
                filter: {
                    field: {
                        in: "hi",
                    },
                },
            },
        })
        assert.equal(r7.status, false)
        assert.equal(r7.error, "validate_query")

        const r8 = await run({
            model: InvalidQueryModel,
            method: Read,
            query: {
                filter: {
                    field: {
                        not_in: "hi",
                    },
                },
            },
        })
        assert.equal(r8.status, false)
        assert.equal(r8.error, "validate_query")
    })
})
