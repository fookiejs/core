import { Type } from "../../core/type";
import * as lodash from "lodash";

export const text = Type.new({
    key: "string",
    validate: lodash.isString,
    example: "abc",
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
            key: "boolean",
            validate: lodash.isBoolean,
        },
        isNotNull: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
    },
});
