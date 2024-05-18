import { describe, expect, it } from "vitest"
import { Model, Field, defaults, LifecycleFunction, FookieError } from "../../src/exports"

describe("Define a field with read role", async () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: { create: { role: [] } },
    })
    class SecureWriteModel extends Model {
        @Field.Decorator({ type: defaults.type.text })
        name?: string

        @Field.Decorator({
            type: defaults.type.text,
            write: [
                LifecycleFunction.new({
                    key: "SecureModelTestFalse",
                    execute: async () => false,
                }),
            ],
        })
        password?: string

        @Field.Decorator({
            type: defaults.type.text,
            write: [
                LifecycleFunction.new({
                    key: "SecureModelTestFalse",
                    execute: async () => false,
                }),
            ],
        })
        secret?: string
    }

    it("Write field error", async () => {
        const response = (await SecureWriteModel.create({
            name: "John Doe",
            password: "123456",
        })) as SecureWriteModel

        expect(response instanceof FookieError).toBe(true)
    })

    it("Write Field Error", async () => {
        const response = (await SecureWriteModel.create({
            name: "John Doe",
            secret: "123456",
        })) as SecureWriteModel

        expect(response instanceof FookieError).toBe(true)
    })

    it("Write Field Error", async () => {
        const response = (await SecureWriteModel.create({
            name: "John Doe",
            secret: "123456",
            password: "123456",
        })) as SecureWriteModel

        expect(response instanceof FookieError).toBe(true)
    })

    it("Write Field Error", async () => {
        const response = (await SecureWriteModel.create({
            name: "John Doe",
        })) as SecureWriteModel

        expect(response instanceof SecureWriteModel).toBe(true)
    })
})
