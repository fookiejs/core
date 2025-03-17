import { expect } from "jsr:@std/expect";
import { Field, Model, defaults, FookieError, Role } from "@fookiejs/core";
import { v4 } from "uuid";

Deno.test("Relation", () => {
  @Model.Decorator({
    database: defaults.database.store,
    binds: {
      create: {
        role: [
          Role.create({
            key: "token_role",
            execute: async function (payload) {
              return payload.options.sub === "token";
            },
          }),
        ],
      },
    },
  })
  class Token extends Model {
    @Field.Decorator({ type: defaults.type.string })
    name!: string;
  }

  Deno.test("should create an entity with valid token", async () => {
    const entity = await Token.create(
      { name: v4() },
      {
        sub: "token",
      }
    );

    expect(entity instanceof Token).toBe(true);
  });

  Deno.test("should fail to create an entity with invalid token", async () => {
    const entity = await Token.create(
      { name: v4() },
      {
        sub: "invalid_token",
      }
    );

    expect(entity instanceof FookieError).toBe(true);
  });
});
