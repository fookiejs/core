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
    Method,
    Rule,
} from "@fookiejs/core"
import { CreateResponse } from "../../src/core/response"

describe("fillModel Function Tests", () => {
    let flag1 = false
    let flag2 = false

    @Model.Decorator({
        database: defaults.database.store,
        binds: { create: { role: [] } },
        mixins: [],
    })
    class TestModel extends Model {
        @Field.Decorator({ type: defaults.type.string, features: [Required] })
        exampleField: string
    }

    addGlobalEffect(
        Effect.new({
            key: "global-test-flag-effect",
            execute: async function (
                payload: Payload<TestModel, Method>,
                cloneResponse: CreateResponse<TestModel>,
            ): Promise<void> {
                payload
                cloneResponse.exampleField
                flag1 = true
            },
        }),
    )

    addGlobalRule(
        Rule.new({
            key: "global-test-flag-pre-rule",
            execute: async function (payload: Payload<TestModel, Method>) {
                payload
                flag2 = true
                return true
            },
        }),
    )

    it("flag and test global", async () => {
        await TestModel.create({ exampleField: "hi" })

        expect(flag1).toBe(true)
    })

    it("flag and test global", async () => {
        await TestModel.read()
        expect(flag2).toBe(true)
    })
})
