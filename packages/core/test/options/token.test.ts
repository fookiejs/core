import { describe, it, expect } from "vitest"
import { Field, Model, defaults, FookieError, Role } from "@fookiejs/core"
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
                            return payload.options.sub === "token"
                        },
                    }),
                ],
            },
        },
    })
    class Token extends Model {
        @Field.Decorator({ type: defaults.type.string })
        name: string
    }

    it("should create an entity with valid token", async () => {
        const entity = await Token.create(
            { name: v4() },
            {
                sub: "token",
            },
        )

        expect(entity instanceof Token).toBe(true)
    })

    it("should fail to create an entity with invalid token", async () => {
        const entity = await Token.create(
            { name: v4() },
            {
                sub: "invalid_token",
            },
        )

        expect(entity instanceof FookieError).toBe(true)
    })
})
