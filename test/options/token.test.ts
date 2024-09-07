import { describe, it, expect } from "vitest"
import { Field, Model, defaults, FookieError, Role } from "../../src/exports"
import { v4 } from "uuid"

describe("Relation", () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: {
            create: {
                role: [
                    Role.new({
                        key: "token_role",
                        execute: async function (payload) {
                            return payload.options.token === "token"
                        },
                    }),
                ],
            },
        },
    })
    class Token extends Model {
        @Field.Decorator({ type: defaults.type.text })
        name: string
    }

    it("should create an entity with valid token", async () => {
        const entity = await Token.create(
            { name: v4() },
            {
                token: "token",
            },
        )

        expect(entity instanceof Token).toBe(true)
    })

    it("should fail to create an entity with invalid token", async () => {
        const entity = await Token.create(
            { name: v4() },
            {
                token: "invalid_token",
            },
        )

        expect(entity instanceof FookieError).toBe(true)
    })
})
