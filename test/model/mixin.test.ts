import { describe, it, expect } from "vitest"
import { Model, Field, defaults, Mixin, PreRule } from "../../src/exports"

// Mixin tanımlama
let createFlag = false

const sampleMixin = Mixin.new({
    key: "flag",
    binds: {
        create: {
            preRule: [
                PreRule.new({
                    key: "mixin_flag",
                    execute: async function () {
                        createFlag = true
                        return true
                    },
                }),
            ],
        },
    },
})

// Testler
describe("fillModel Function Tests", () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: { create: { role: [] } },
        mixins: [sampleMixin],
    })
    class TestModel extends Model {
        @Field.Decorator({ type: defaults.type.text, required: true })
        name!: string
    }

    it("should merge mixin binds into model binds correctly", async () => {
        await TestModel.create({ name: "Test Name" })

        expect(createFlag).toBe(true)
    })
})
