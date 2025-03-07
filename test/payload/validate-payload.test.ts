import { describe, it, expect } from "vitest"
import { Model, Field, defaults, FookieError } from "../../src/exports"

// Model Tanımlama
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
class QueryTextModel extends Model {
    @Field.Decorator({ type: defaults.type.string })
    textField: string
}

// Testler
describe("QueryTextModel validate_payload Tests", async () => {
    await QueryTextModel.create({ textField: "abc" })
    await QueryTextModel.create({ textField: "def" })
    await QueryTextModel.create({ textField: "ghi" })

    it("should throw error if options is not an object", async () => {
        const results = await QueryTextModel.read({}, "invalid_option")
        expect(results instanceof FookieError).toBeTruthy()
    })

    it("should throw error if options.token is not a string", async () => {
        const results = await QueryTextModel.read(
            {},
            {
                token: 1,
            },
        )

        expect(results instanceof FookieError).toBeTruthy()
    })

    it("should throw error if body is not an object", async () => {
        const results = await QueryTextModel.create("abc")

        expect(results instanceof FookieError).toBeTruthy()
    })

    it("should throw error if body is not an object", async () => {
        const results = await QueryTextModel.create({
            a: 1,
        })

        expect(results instanceof FookieError).toBeTruthy()
    })

    it("should throw error if query is not an object", async () => {
        const results = await QueryTextModel.read({
            filter: "abc",
        })

        expect(results instanceof FookieError).toBeTruthy()
    })

    it("should throw error if options.drop is not a number", async () => {
        const results = await QueryTextModel.read(
            {
                filter: {
                    textField: { equals: "abc" },
                },
            },
            { drop: "notANumber" },
        )

        expect(results instanceof FookieError).toBeTruthy()
    })

    it("should throw error if query is not a object", async () => {
        const results = await QueryTextModel.read("invalid_query")

        expect(results instanceof FookieError).toBeTruthy()
    })

    it("should return results for valid payload", async () => {
        const results = await QueryTextModel.read({
            filter: {
                textField: { equals: "abc" },
            },
        })
        expect(results).toHaveLength(1)
        expect(results[0].textField).toBe("abc")
    })
})
