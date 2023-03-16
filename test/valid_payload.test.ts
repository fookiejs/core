import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("valid payload", async function () {
    await init
    const res = await run({
        token: 1,
        model: "model",
        method: "read",
        options: {
            drop: "abc",
        },
    })
    assert.equal(res.status, false)
    assert.equal(res.error, "valid_payload")
})
it("valid payload", async function () {
    await init
    const res = await run({
        model: 1,
        method: "read",
    })
    assert.equal(res.status, false)
    assert.equal(res.error, "valid_payload")
})

it("valid payload", async function () {
    await init
    const res = await run({
        model: "model",
        method: 1,
    })
    assert.equal(res.status, false)
    assert.equal(res.error, "valid_payload")
})

it("valid payload", async function () {
    await init
    const res = await run({
        model: "model",
        method: "read",
        body: 1,
    })
    assert.equal(res.status, false)
    assert.equal(res.error, "valid_payload")
})

it("valid payload", async function () {
    await init
    const res = await run({
        model: "model",
        method: "read",
        options: 1,
    })
    assert.equal(res.status, false)
    assert.equal(res.error, "valid_payload")
})

it("valid payload", async function () {
    await init
    const res = await run({
        model: "model",
        method: "read",
        query: 1,
    })
    assert.equal(res.status, false)
    assert.equal(res.error, "valid_payload")
})

it("valid payload", async function () {
    await init
    const res = await run({
        model: "model",
        method: "read",
        options: {
            drop: "abc",
        },
    })
    assert.equal(res.status, false)
    assert.equal(res.error, "valid_payload")
})

it("valid payload", async function () {
    await init
    const res = await run({
        model: "model",
        method: "read",
        options: {
            method: 1,
        },
    })
    assert.equal(res.status, false)
    assert.equal(res.error, "valid_payload")
})

it("valid payload", async function () {
    await init
    const res = await run({
        model: "model",
        method: "read",
        options: {
            simplified: 1,
        },
    })
    assert.equal(res.status, false)
    assert.equal(res.error, "valid_payload")
})
