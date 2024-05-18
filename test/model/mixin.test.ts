import { describe, it, expect } from "vitest";
import { Model, Field, defaults, LifecycleFunction, Mixin, Payload } from "../../src/exports.ts";

// Mixin tanımlama
let createFlag = false;

const sampleMixin = Mixin.new({
    key: "flag",
    binds: {
        create: {
            preRule: [
                LifecycleFunction.new({
                    key: "mixin_flag",
                    execute: function (payload: Payload<typeof Model, unknown>) {
                        createFlag = true;
                    },
                }),
            ],
        },
    },
});

// Testler
describe("fillModel Function Tests", () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: { create: { role: [] } },
        mixins: [sampleMixin],
    })
    class TestModel extends Model {
        @Field.Decorator({ type: defaults.type.text, required: true })
        name!: string;
    }

    it("should merge mixin binds into model binds correctly", async () => {
        await TestModel.create({ name: "Test Name" });

        expect(createFlag).toBe(true);
    });
});
