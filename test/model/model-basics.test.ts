import { test } from "vitest"
import { Model, Field, defaults, LifecycleFunction } from "../../src/exports"

test("Define a simple model", async () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: {
            read: {
                role: [],
            },
            create: {
                role: [
                    LifecycleFunction.new({
                        key: "example-lifecycle",
                        execute: async function (payload) {
                            return true
                        },
                    }),
                ],
            },
        },
    })
    class User extends Model {
        @Field.Decorator({ required: true, type: defaults.type.text })
        email: string
    }
})

test("Define a model with relations.", async () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: {},
    })
    class Address extends Model {
        @Field.Decorator({ required: true, type: defaults.type.text, unique: true })
        city: string
    }

    @Model.Decorator({
        database: defaults.database.store,
        binds: {},
    })
    class Place extends Model {
        @Field.Decorator({ required: true, type: defaults.type.text, relation: Address })
        address: string
    }
})
