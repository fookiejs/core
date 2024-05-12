import { Type } from "../../core/type";
import * as lodash from "lodash";

export const text = Type.new({
    key: "string",
    validate: function (value: unknown): boolean {
        return lodash.isString(value);
    },
    example: "hi",
    queryController: {
        equals: {
            key: "string",
            validate: lodash.isString,
        },
        notEquals: {
            key: "string",
            validate: lodash.isString,
        },
        in: {
            key: "string",
            validate: lodash.isString,
            isArray: true,
        },
        notIn: {
            key: "string",
            validate: lodash.isString,
            isArray: true,
        },
        like: {
            key: "string",
            validate: lodash.isString,
        },
        notLike: {
            key: "string",
            validate: lodash.isString,
        },
        isNull: {
            key: "string",
            validate: lodash.isBoolean,
        },
        isNotNull: {
            key: "string",
            validate: lodash.isBoolean,
        },
    },
});
