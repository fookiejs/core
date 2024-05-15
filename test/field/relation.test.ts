import { expect, test, describe } from "vitest";
import { Model, Field, defaults } from "../../src/exports.ts";
import { FookieError } from "../../src/core/error.ts";

describe("relation", () => {
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
    class RelationAddressModel extends Model {
        @Field.Decorator({ type: defaults.type.text })
        street?: string;

        @Field.Decorator({ type: defaults.type.text })
        city?: string;
    }

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
    class RelationUserModel extends Model {
        @Field.Decorator({ type: defaults.type.text })
        name?: string;

        @Field.Decorator({ relation: RelationAddressModel })
        address?: string;
    }

    test("Create an address and relate it to a user successfully", async () => {
        const addressResponse = await RelationAddressModel.create({
            street: "street",
            city: "city",
        });

        expect(addressResponse instanceof RelationAddressModel).toBe(true);

        const userResponse = await RelationUserModel.create({
            name: "John Doe",
            address: addressResponse.id,
        });
        expect(userResponse instanceof RelationUserModel).toBe(true);

        if (userResponse instanceof RelationUserModel) {
            expect(addressResponse.id === userResponse.address).toBe(true);
        }
    });

    test("Create an address and relate it to a user error", async () => {
        const userResponse = await RelationUserModel.create({
            name: "John Doe",
            address: "wrong-id",
        });
        expect(userResponse instanceof FookieError).toBe(true);

        if (userResponse instanceof FookieError) {
            expect(userResponse.key === "has_entity").toBeTruthy();
        }
    });
});
