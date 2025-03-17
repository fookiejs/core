import { expect } from "jsr:@std/expect";
import { Model, Field, defaults, Role } from "@fookiejs/core";

Deno.test("Define a simple model", async () => {
  @Model.Decorator({
    database: defaults.database.store,
    binds: {
      read: {
        role: [],
      },
      create: {
        role: [
          Role.create({
            key: "example-lifecycle",
            execute: async function () {
              return true;
            },
          }),
        ],
      },
    },
  })
  class User extends Model {
    @Field.Decorator({
      features: [defaults.feature.required],
      type: defaults.type.string,
    })
    email!: string;
  }
  User;
});

Deno.test("Define a model with relations.", async () => {
  @Model.Decorator({
    database: defaults.database.store,
    binds: {},
  })
  class Address extends Model {
    @Field.Decorator({
      type: defaults.type.string,
      features: [defaults.feature.unique, defaults.feature.required],
    })
    city!: string;
  }

  @Model.Decorator({
    database: defaults.database.store,
    binds: {},
  })
  class Place extends Model {
    @Field.Decorator({
      type: defaults.type.string,
      relation: Address,
      features: [defaults.feature.required],
    })
    address!: string;
  }
  Place;
});
