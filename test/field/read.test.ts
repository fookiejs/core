import { describe, expect, test } from "vitest"
import { Model, Field, defaults, LifecycleFunction } from "../../src/exports"

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
                LifecycleFunction.new({
                    key: "SecureModelTestFalse",
                    execute: async () => false,
                }),
            ],
        })
        password?: string
    }

    test("Attempt to write to a field with read restrictions", async () => {
        const response = (await SecureModel.create({
            name: "John Doe",
            password: "123456",
        })) as SecureModel

        expect(response.password).toBeUndefined()
    })

    test("Attempt to write to a field with write restrictions", async () => {
        const response = await SecureModel.read({})
        for (const obj of response) {
            expect(obj).not.toHaveProperty("pasword")
            expect(obj).toHaveProperty("name")
        }
    })
})
