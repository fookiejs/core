import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text, Number } from "../src/types"
import * as lodash from "lodash"

describe("valid payload", async function () {
    @Model({ database: Store })
    class InvalidPayloadModel {
        @Field({ type: Number, required: true })
        field: number
        @Field({ type: Text, required: true })
        field2: string
    }

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
