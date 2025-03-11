import { describe, it } from "vitest"
import { defaults, Effect, Field, Lifecycle, Method, Model, models, Rule } from "../../src/exports"

describe("Payload Type Safety Tests", () => {
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
    class TypeCheckUser extends Model {
        @Field.Decorator({ type: defaults.type.string })
        email: string

        @Field.Decorator({ type: defaults.type.string })
        username: string
    }

    it("should have correct payload types for CREATE method", () => {
        Rule.new<TypeCheckUser, Method.CREATE>({
            key: "create_test",
            execute: async (payload) => {
                payload.body.email
                payload.body.username
                return true
            },
        })
    })

    it("should have correct payload types for READ method", () => {
        Rule.new<TypeCheckUser, Method.READ>({
            key: "read_test",
            execute: async (payload) => {
                payload.query.filter
                return true
            },
        })
    })

    it("should have correct payload types for UPDATE method", () => {
        Rule.new<TypeCheckUser, Method.UPDATE>({
            key: "update_test",
            execute: async (payload) => {
                payload.query
                payload.body.email
                return true
            },
        })
    })

    it("should have correct payload types for DELETE method", () => {
        Rule.new<TypeCheckUser, Method.DELETE>({
            key: "delete_test",
            execute: async (payload) => {
                payload.query
                return true
            },
        })
    })

    it("type parameter test", () => {
        Rule.new({
            key: "delete_test",
            execute: async (payload) => {
                payload.model
                payload.method
                return true
            },
        })

        Rule.new<TypeCheckUser>({
            key: "delete_test",
            execute: async (payload) => {
                payload.model.read()
                payload.method
                return true
            },
        })
    })
})
