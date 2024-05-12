import { expect, it } from "vitest";
import * as lodash from "lodash";
import { Model, Field, defaults, LifecycleFunction } from "../../src/exports.ts";

@Model.Decorator({
    database: defaults.database.store,
    binds: {
        read: {
            role: [],
        },
        create: {
            role: [
                LifecycleFunction.new({
                    key: "example-lifecycle",
                    execute: async function (payload) {
                        return true;
                    },
                }),
            ],
        },
    },
})
class User extends Model {
    @Field.Decorator({ required: true, type: defaults.type.text })
    email: string;

    @Field.Decorator({ required: true, type: defaults.type.integer })
    usage: number;
}

it("should create a user correctly", async () => {
    const createResponse = await User.create({
        email: "test@fookiejs.com",
        usage: 3,
    });
    expect(createResponse instanceof User).toEqual(true);
});

it("should read users correctly", async () => {
    const readResponse = await User.read({});
    expect(lodash.isArray(readResponse)).toEqual(true);
});

it("should update a user correctly", async () => {
    const updateResponse = await User.update(
        {
            filter: {
                id: {
                    equals: "example-id",
                },
            },
        },
        {
            email: "tester@fookiejs.com",
        },
    );
    expect(updateResponse).toEqual(true);
});

it("should delete a user correctly", async () => {
    const deleteResponse = await User.delete({
        filter: {
            id: {
                equals: "example-id",
            },
        },
    });
    expect(deleteResponse).toEqual(true);
});

it("should count users correctly", async () => {
    const countResponse = await User.count({
        filter: {
            id: {
                equals: "example-id",
            },
        },
    });
    expect(countResponse).toEqual(0);
});

it("should sum user usage correctly", async () => {
    const sumResponse = await User.sum(
        {
            filter: {
                id: {
                    equals: "example-id",
                },
            },
        },
        "usage",
    );
    expect(sumResponse).toEqual(0);
});
