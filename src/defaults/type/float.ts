import { Type } from "../../core/type";
import * as lodash from "lodash";

export const float = Type.new({
    key: "float",
    validate: function (value: unknown): boolean {
        return lodash.isNumber(value);
    },
    example: 1,
    queryController: {
        equals: {
            key: "float",
            validate: lodash.isNumber,
        },
        notEquals: {
            key: "float",
            validate: lodash.isNumber,
        },

        gte: { key: "float", validate: lodash.isNumber },
        gt: { key: "float", validate: lodash.isNumber },
        lte: { key: "float", validate: lodash.isNumber },
        lt: { key: "float", validate: lodash.isNumber },
        in: {
            key: "float",
            validate: lodash.isNumber,
            isArray: true,
        },
        notIn: {
            key: "float",
            validate: lodash.isNumber,
            isArray: true,
        },
        isNull: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
    },
});
