import { expect } from "jsr:@std/expect";
import { Model, Field, defaults, FookieError } from "@fookiejs/core";

Deno.test("Define a unique field with Error", async () => {
  @Model.Decorator({
    database: defaults.database.store,
    binds: {
      read: { role: [] },
      create: { role: [] },
    },
  })
  class UniqueField extends Model {
    @Field.Decorator({
      features: [defaults.feature.unique],
      type: defaults.type.string,
    })
    username!: string;
  }

  const firstResponse = await UniqueField.create({
    username: "uniqueUser",
  });

  expect(firstResponse instanceof UniqueField).toBe(true);

  try {
    await UniqueField.create({
      username: "uniqueUser",
    });
    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof FookieError).toBe(true);
    expect((error as FookieError).name === "unique").toBe(true);
  }
});
