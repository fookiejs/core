import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

describe("validate_query", async function () {
    @Model({ database: Store })
    class InvalidQueryModel {
        @Field({ type: Number, required: true })
        field: number
        @Field({ type: Text, required: true })
        field2: string
    }

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
                        or: "hi",
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
                        notor: "hi",
                    },
                },
            },
        })
        assert.equal(r8.status, false)
        assert.equal(r8.error, "validate_query")
    })
})
