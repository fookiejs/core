import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, run, models, lifecycle } from "../packages/core"
import { Store, database } from "../packages/database"
import { Model, Field } from "../packages/decorator"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import { Text, Number, Array, Boolean, Buffer, Char, Function, Plain } from "../packages/type"
import { mixin, After, Before } from "../packages/mixin"

describe("valid payload", async function () {
    const InvalidPayloadModel = await model({
        name: "InvalidPayloadModel",
        database: Store,
        schema: {
            field: { type: Text, required: true },
            field2: { type: Text, required: true },
        },
    })

    it("valid payload 1", async function () {
        const res = await run({
            model: InvalidPayloadModel,
            method: Read,
            options: {
                drop: "abc",
            },
        })

        assert.equal(res.status, false)
        assert.equal(res.error, "validate_payload")
    })

    it("valid payload 3", async function () {
        const res = await run({
            model: InvalidPayloadModel,
            method: Create,
            body: 1,
        })
        assert.equal(res.status, false)
        assert.equal(res.error, "validate_payload")
    })

    it("valid payload 4", async function () {
        const res = await run({
            model: InvalidPayloadModel,
            method: "read",
            options: 1,
        })
        assert.equal(res.status, false)
        assert.equal(res.error, "validate_payload")
    })

    it("valid payload 5", async function () {
        const res = await run({
            model: InvalidPayloadModel,
            method: "read",
            query: 1,
        })
        assert.equal(res.status, false)
        assert.equal(res.error, "validate_payload")
    })

    it("valid payload 6", async function () {
        const res = await run({
            model: InvalidPayloadModel,
            method: "read",
            options: {
                drop: "abc",
            },
        })
        assert.equal(res.status, false)
        assert.equal(res.error, "validate_payload")
    })

    it("valid payload 7", async function () {
        const res = await run({
            model: InvalidPayloadModel,
            method: "read",
            options: {
                method: 1,
            },
        })
        assert.equal(res.status, false)
        assert.equal(res.error, "validate_payload")
    })

    it("valid payload 8", async function () {
        const res = await run({
            model: InvalidPayloadModel,
            method: "read",
            options: {
                simplified: 1,
            },
        })
        assert.equal(res.status, false)
        assert.equal(res.error, "validate_payload")
    })
})
