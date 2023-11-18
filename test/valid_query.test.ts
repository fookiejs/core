import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

describe("validate_query", async function () {
    const InvalidQueryModel = await Fookie.Builder.model({
        name: "InvalidQueryModel",
        database: Fookie.Dictionary.Database.store,
        schema: {
            field: { type: Fookie.Dictionary.Type.text, required: true },
            field2: { type: Fookie.Dictionary.Type.text, required: true },
        },
        bind: {
            read: {},
        },
    })

    it("valid query", async function () {
        const res = await Fookie.run({
            model: InvalidQueryModel,
            method: Fookie.Method.Read,
            query: {
                filter: undefined,
            },
        })

        assert.equal(res.status, false)
        assert.equal(res.error, "validate_query")
    })

    it("valid query", async function () {
        const res = await Fookie.run({
            model: InvalidQueryModel,
            method: Fookie.Method.Read,
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
        const res = await Fookie.run({
            model: InvalidQueryModel,
            method: Fookie.Method.Read,
            query: {
                offset: "hi",
            },
        })

        assert.equal(res.status, false)
        assert.equal(res.error, "validate_query")
    })

    it("valid query", async function () {
        const res = await Fookie.run({
            model: InvalidQueryModel,
            method: Fookie.Method.Read,
            query: {
                limit: "hi",
            },
        })

        assert.equal(res.status, false)
        assert.equal(res.error, "validate_query")
    })

    it("valid query", async function () {
        const res = await Fookie.run({
            model: InvalidQueryModel,
            method: Fookie.Method.Read,
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
        const r1 = await Fookie.run({
            model: InvalidQueryModel,
            method: Fookie.Method.Read,
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

        const r2 = await Fookie.run({
            model: InvalidQueryModel,
            method: Fookie.Method.Read,
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

        const r3 = await Fookie.run({
            model: InvalidQueryModel,
            method: Fookie.Method.Read,
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

        const r4 = await Fookie.run({
            model: InvalidQueryModel,
            method: Fookie.Method.Read,
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

        const r5 = await Fookie.run({
            model: InvalidQueryModel,
            method: Fookie.Method.Read,
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

        const r6 = await Fookie.run({
            model: InvalidQueryModel,
            method: Fookie.Method.Read,
            query: {
                filter: {
                    field: {
                        include: 111,
                    },
                },
            },
        })
        assert.equal(r6.status, false)
        assert.equal(r6.error, "validate_query")

        const r7 = await Fookie.run({
            model: InvalidQueryModel,
            method: Fookie.Method.Read,
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

        const r8 = await Fookie.run({
            model: InvalidQueryModel,
            method: Fookie.Method.Read,
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
