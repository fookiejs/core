import { describe, it, expect } from "vitest";
import { Field, Model, defaults } from "../../src/exports";

describe("Cascase", () => {
    @Model.Decorator({
        database: defaults.database.store,
    })
    class User extends Model {
        @Field.Decorator({ type: defaults.type.text })
        name?: string;
    }

    @Model.Decorator({
        database: defaults.database.store,
    })
    class Order extends Model {
        @Field.Decorator({ relation: User, cascadeDelete: true })
        userId?: string;
    }

    it("Cascade delete should remove all related orders when a user is deleted", async () => {
        const user = (await User.create({ name: "John Doe" })) as User;
        const order1 = await Order.create({ userId: user.id });
        const order2 = await Order.create({ userId: user.id });

        // User'ı sil
        await User.delete({ id: user.id });

        const remainingOrders = await Order.read({ userId: user.id });

        expect(remainingOrders.length).toBe(0);
    });
});
