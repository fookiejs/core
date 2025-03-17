import { Model, Field, defaults, FookieError } from "@fookiejs/core";
import { expect } from "jsr:@std/expect";
import { assertRejects } from "jsr:@std/assert";

// Model tanımlama
@Model.Decorator({
  database: defaults.database.store,
  binds: { create: { role: [] } },
})
class ArrayFieldModel extends Model {
  @Field.Decorator({
    type: defaults.type.array(defaults.type.string),
    features: [defaults.feature.required],
  })
  field!: string[];
}

Deno.test("should create a model instance with valid array field", async () => {
  const validData = { field: ["text1", "text2", "text3"] };
  const result = await ArrayFieldModel.create(validData);
  expect(result).toBeTruthy();
});

Deno.test(
  "should fail to create a model instance with invalid array field",
  async () => {
    const invalidData = { field: ["text1", 123, "text3"] };

    try {
      // @ts-expect-error
      await ArrayFieldModel.create(invalidData);
      expect(false).toBe(true);
    } catch (error) {
      expect(error instanceof FookieError).toBe(true);
    }
  }
);

Deno.test("should handle isNull query correctly", async () => {
  const nullData = { field: null };

  try {
    // @ts-expect-error
    await ArrayFieldModel.create(nullData);
    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof FookieError).toBe(true);
  }

  const nonNullData = { field: ["NaN", "null", "undefined"] };
  const nonNullResult = await ArrayFieldModel.create(nonNullData);
  expect(nonNullResult instanceof ArrayFieldModel).toBeTruthy();
});
