import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

describe("valid payload", async function () {
    const InvalidPayloadModel = await Fookie.Builder.model({
        name: "InvalidPayloadModel",
        database: Fookie.Dictionary.Database.store,
        schema: {
            field: { type: Fookie.Dictionary.Type.text, required: true },
            field2: { type: Fookie.Dictionary.Type.text, required: true },
        },
    })

    it("valid payload 1", async function () {
        const res = await Fookie.run({
            model: InvalidPayloadModel,
            method: Fookie.Method.Read,
            options: {
                drop: "abc",
            },
        })

        assert.equal(res.status, false)
        assert.equal(res.error, "validate_payload")
    })

    it("valid payload 3", async function () {
        const res = await Fookie.run({
            model: InvalidPayloadModel,
            method: Fookie.Method.Create,
            body: 1,
        })
        assert.equal(res.status, false)
        assert.equal(res.error, "validate_payload")
    })

    it("valid payload 4", async function () {
        const res = await Fookie.run({
            model: InvalidPayloadModel,
            method: "read",
            options: 1,
        })
        assert.equal(res.status, false)
        assert.equal(res.error, "validate_payload")
    })

    it("valid payload 5", async function () {
        const res = await Fookie.run({
            model: InvalidPayloadModel,
            method: "read",
            query: 1,
        })
        assert.equal(res.status, false)
        assert.equal(res.error, "validate_payload")
    })

    it("valid payload 6", async function () {
        const res = await Fookie.run({
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
        const res = await Fookie.run({
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
        const res = await Fookie.run({
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
