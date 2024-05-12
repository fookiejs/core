import { Type } from "../../core/type";
import * as lodash from "lodash";

export const integer = Type.new({
    key: "int",
    validate: function (value: unknown): boolean {
        return lodash.isInteger(value);
    },
    example: 1,
    queryController: {
        equals: {
            key: "int",
            validate: lodash.isInteger,
        },
        notEquals: {
            key: "int",
            validate: lodash.isInteger,
        },

        gte: { key: "int", validate: lodash.isInteger },
        gt: { key: "int", validate: lodash.isInteger },
        lte: { key: "int", validate: lodash.isInteger },
        lt: { key: "int", validate: lodash.isInteger },
        in: {
            key: "int",
            validate: lodash.isInteger,
            isArray: true,
        },
        notIn: {
            key: "int",
            validate: lodash.isInteger,
            isArray: true,
        },
        isNull: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
        isNotNull: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
    },
});
