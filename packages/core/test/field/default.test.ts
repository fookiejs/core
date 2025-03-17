import { expect } from "jsr:@std/expect";
import { Field, Model, defaults } from "@fookiejs/core";

Deno.test("Define a field with a default value", async () => {
  @Model.Decorator({
    database: defaults.database.store,
    binds: {
      create: {
        role: [],
      },
    },
  })
  class DefaultFieldModel extends Model {
    @Field.Decorator({
      type: defaults.type.string,
      default: "defaultVal",
    })
    myField?: string;
  }

  const response = await DefaultFieldModel.create({});
  expect(response instanceof DefaultFieldModel).toBe(true);
  if (response instanceof DefaultFieldModel) {
    expect(response.myField).toBe("defaultVal");
  }
});
