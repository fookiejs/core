import { expect, it } from "vitest"
import * as lodash from "lodash"
import { Model, Field, defaults, Config, Role, Required } from "../../src/exports"

@Model.Decorator({
    database: defaults.database.store,
    binds: {
        read: {
            role: [],
        },
        update: {
            role: [],
        },
        delete: {
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

    @Field.Decorator({ features: [Required], type: defaults.type.number })
    usage: number
}

it("should create a user correctly", async () => {
    const createResponse = await User.create({
        email: "test@fookiejs.com",
        usage: 3,
    })
    expect(createResponse instanceof User).toEqual(true)
})

it("should read users correctly", async () => {
    const readResponse = await User.read({})
    expect(lodash.isArray(readResponse)).toEqual(true)
})

it("should update a user correctly", async () => {
    const users = await User.read({})
    const updateResponse = await User.update(
        {
            filter: {
                id: {
                    in: users.map((u) => u.id),
                },
            },
        },
        {
            email: "tester@fookiejs.com",
        },
    )
    expect(updateResponse).toEqual(true)
})

it("should delete a user correctly", async () => {
    const deleteResponse = await User.delete({
        filter: {
            id: {
                equals: "example-id",
            },
        },
    })
    expect(deleteResponse).toEqual(true)
})
