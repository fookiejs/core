import { describe, expect, test } from "vitest"
import { Model, Field, defaults, Role } from "../../src/exports"

describe("Define a field with read role", async () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: {
            create: {
                role: [],
            },
            read: {
                role: [],
            },
        },
    })
    class SecureModel extends Model {
        @Field.Decorator({ type: defaults.type.text })
        name?: string

        @Field.Decorator({
            type: defaults.type.text,
            read: [
                Role.new({
                    key: "SecureModelTestFalse",
                    execute: async () => false,
                }),
            ],
        })
        userPw?: string
    }

    test("Attempt to write to a field with read restrictions", async () => {
        const response = (await SecureModel.create({
            name: "John Doe",
            userPw: "dont-see-me",
        })) as SecureModel

        expect(response.userPw).toBeUndefined()
    })

    test("Attempt to write to a field with write restrictions", async () => {
        const response = await SecureModel.read({})
        for (const obj of response) {
            expect(obj).not.toHaveProperty("pasword")
            expect(obj).toHaveProperty("name")
        }
    })
})
