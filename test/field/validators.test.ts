import { expect, test } from "vitest";
import { Model, Field, defaults } from "../../src/exports.ts";
import { FookieError } from "../../src/core/error.ts";

test("Field with a validator passing validation", async () => {
    @Model.Decorator({
        database: defaults.database.store,
    })
    class ValidatorModel extends Model {
        @Field.Decorator({
            type: defaults.type.integer,
            validators: [
                (value) => {
                    return value >= 10 && value <= 20;
                },
            ],
        })
        myNumber?: number;
    }

    const validResponse = await ValidatorModel.create({ myNumber: 15 });
    expect(validResponse instanceof ValidatorModel).toBe(true);
});

test("Field with a validator failing validation", async () => {
    @Model.Decorator({
        database: defaults.database.store,
    })
    class ValidatorModel extends Model {
        @Field.Decorator({
            type: defaults.type.integer,
            validators: [
                (value) => {
                    const isValid = value >= 10 && value <= 20;
                    return isValid === true || "number_not_in_range";
                },
            ],
        })
        myNumber?: number;
    }

    const invalidResponse = await ValidatorModel.create({ myNumber: 25 });

    expect(invalidResponse instanceof FookieError).toBe(true);
    if (invalidResponse instanceof FookieError) {
        expect(invalidResponse.key === "validate_body").toBe(true);
        expect(invalidResponse.validationErrors.myNumber[0] === "number_not_in_range").toBe(true);
    }
});
