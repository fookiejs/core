import { describe, it, expect } from "vitest";
import { Model, Field, defaults, FookieError } from "../../src/exports";

describe("ArrayFieldModel Tests", () => {
    // Model tanımlama
    @Model.Decorator({
        database: defaults.database.store,
        binds: { create: { role: [] } },
    })
    class ArrayFieldModel extends Model {
        @Field.Decorator({ type: defaults.type.array(defaults.type.text), required: true })
        field!: string[];
    }

    it("should create a model instance with valid array field", async () => {
        const validData = { field: ["text1", "text2", "text3"] };
        const result = await ArrayFieldModel.create(validData);
        expect(result).toBeTruthy();
    });

    it("should fail to create a model instance with invalid array field", async () => {
        const invalidData = { field: ["text1", 123, "text3"] };

        const response = await ArrayFieldModel.create(invalidData);

        expect(response instanceof FookieError).toBeTruthy();
        expect(response.key).toBe("check_type");
    });

    it("should handle isNull query correctly", async () => {
        const nullData = { field: null };
        const result = await ArrayFieldModel.create(nullData);

        expect(result instanceof FookieError).toBeTruthy();

        const nonNullData = { field: ["NaN", "null", "undefined"] };
        const nonNullResult = await ArrayFieldModel.create(nonNullData);
        expect(nonNullResult instanceof ArrayFieldModel).toBeTruthy();
    });
});
