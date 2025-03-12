import { test } from "vitest"
import { Model, Field, defaults, Role, Unique, Required } from "@fookiejs/core"

test("Define a simple model", async () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: {
            read: {
                role: [],
            },
            create: {
                role: [
                    Role.new({
                        key: "example-lifecycle",
                        execute: async function () {
                            return true
                        },
                    }),
                ],
            },
        },
    })
    class User extends Model {
        @Field.Decorator({ features: [Required], type: defaults.type.string })
        email: string
    }
    User
})

test("Define a model with relations.", async () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: {},
    })
    class Address extends Model {
        @Field.Decorator({ type: defaults.type.string, features: [Unique, Required] })
        city: string
    }

    @Model.Decorator({
        database: defaults.database.store,
        binds: {},
    })
    class Place extends Model {
        @Field.Decorator({ type: defaults.type.string, relation: Address, features: [Required] })
        address: string
    }
    Place
})
