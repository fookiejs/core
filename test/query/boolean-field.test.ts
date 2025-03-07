import { describe, it, expect } from "vitest"
import { Model, Field, defaults, FookieError } from "../../src/exports"

describe("QueryBooleanModel Query Tests", async () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: {
            read: {
                role: [],
            },
            create: {
                role: [],
            },
        },
    })
    class QueryBooleanModel extends Model {
        @Field.Decorator({ type: defaults.type.boolean })
        booleanField!: boolean
    }

    await QueryBooleanModel.create({ booleanField: true })
    await QueryBooleanModel.create({ booleanField: false })
    await QueryBooleanModel.create({ booleanField: true })

    it("equals query", async () => {
        const results = await QueryBooleanModel.read({
            filter: {
                booleanField: { equals: true },
            },
        })
        expect(results).toHaveLength(2)
        expect(results.every((r) => r.booleanField === true)).toBe(true)
    })

    it("notEquals query", async () => {
        const results = await QueryBooleanModel.read({
            filter: {
                booleanField: { notEquals: true },
            },
        })
        expect(results).toHaveLength(1)
        expect(results[0].booleanField).toBe(false)
    })

    it("isNull query", async () => {
        const results = await QueryBooleanModel.read({
            filter: {
                booleanField: { isNull: true },
            },
        })

        expect(results).toHaveLength(0)
    })

    it("isNotNull query", async () => {
        const results = await QueryBooleanModel.read({
            filter: {
                booleanField: { isNull: false },
            },
        })
        expect(results).toHaveLength(3)
    })

    it("notExist query", async () => {
        const results = await QueryBooleanModel.read({
            filter: {
                booleanField: { notExist: false },
            },
        })
        expect(results instanceof FookieError).toBeTruthy()
    })
})
