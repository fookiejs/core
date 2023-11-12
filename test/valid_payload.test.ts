import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

import Selection from "../packages/selection"

describe("valid payload", async function () {
    const InvalidPayloadModel = await model({
        name: "InvalidPayloadModel",
        database: Database.Store,
        schema: {
            field: { type: Type.Text, required: true },
            field2: { type: Type.Text, required: true },
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
