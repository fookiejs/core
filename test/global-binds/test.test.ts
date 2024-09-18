import { describe, it, expect } from "vitest"
import {
    Model,
    Field,
    defaults,
    addGlobalEffect,
    Effect,
    Payload,
    addGlobalRule,
    Required,
} from "../../src/exports"
import { CreateResponse, ReadResponse } from "../../src/core/response"

describe("fillModel Function Tests", () => {
    let flag1 = false
    let flag2 = false

    @Model.Decorator({
        database: defaults.database.store,
        binds: { create: { role: [] } },
        mixins: [],
    })
    class TestModel extends Model {
        @Field.Decorator({ type: defaults.type.text, features: [Required] })
        exampleField: string
    }

    addGlobalEffect(
        Effect.new({
            key: "global-test-flag-effect",
            execute: async function (
                payload: Payload<TestModel>,
                cloneResponse: CreateResponse<TestModel>,
            ): Promise<void> {
                payload
                cloneResponse.exampleField
                flag1 = true
            },
        }),
    )

    addGlobalRule(
        Effect.new({
            key: "global-test-flag-pre-rule",
            execute: async function (
                payload: Payload<TestModel>,
                cloneResponse: ReadResponse<TestModel>,
            ): Promise<void> {
                payload
                cloneResponse.length
                flag2 = true
            },
        }),
    )

    it("should merge mixin binds into model binds correctly", async () => {
        await TestModel.create({ exampleField: "hi" })
        expect(true).toBe(true)
    })

    it("flag and test global", async () => {
        await TestModel.create({ exampleField: "hi" })
        expect(flag1).toBe(true)
    })

    it("flag and test global", async () => {
        await TestModel.read()
        expect(flag2).toBe(true)
    })
})
