import { expect, test } from "vitest";
import * as lodash from "lodash";
import { Model, Field, defaults, LifecycleFunction } from "../../src/exports.ts";

test("Model methods must be working.", async () => {
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

        @Field.Decorator({ required: true, type: defaults.type.number })
        usage: number;
    }

    const createResponse = await User.create({
        email: "test@fookiejs.com",
        usage: 3,
    });
    expect(createResponse instanceof User).toEqual(true);

    const readResponse = await User.read({});

    expect(lodash.isArray(readResponse)).toEqual(true);

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

    const deleteResponse = await User.delete({
        filter: {
            id: {
                equals: "example-id",
            },
        },
    });
    expect(deleteResponse).toEqual(true);

    const countResponse = await User.count({
        filter: {
            id: {
                equals: "example-id",
            },
        },
    });

    expect(countResponse).toEqual(0);

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
