/* eslint-disable indent */
import { describe, it, expect } from "vitest"
import { Field, Model, defaults } from "../../src/exports"

describe("Cascase", () => {
    @Model.Decorator({
        database: defaults.database.store,
        binds: {
            read: { role: [] },
            create: { role: [] },
            delete: { role: [] },
        },
    })
    class User extends Model {
        @Field.Decorator({ type: defaults.type.string })
        name?: string
    }

    @Model.Decorator({
        database: defaults.database.store,
        binds: {
            read: { role: [] },
            create: { role: [] },
            delete: { role: [] },
        },
    })
    class Order extends Model {
        @Field.Decorator({ relation: User, cascadeDelete: true })
        userId?: string
    }

    it("Cascade delete should remove all related orders when a user is deleted", async () => {
        const user = (await User.create({ name: "John Doe" })) as User
        await Order.create({ userId: user.id })
        await Order.create({ userId: user.id })

        await User.delete({
            filter: {
                id: {
                    equals: user.id,
                },
            },
        })

        const remainingOrders = await Order.read({
            filter: {
                userId: {
                    equals: user.id,
                },
            },
        })

        expect(remainingOrders.length).toBe(0)
    })
})
