import { Type } from "../../core/type";
import * as lodash from "lodash";

export const boolean = Type.new({
    key: "boolean",
    validate: lodash.isBoolean,
    example: true,
    queryController: {
        equals: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
        notEquals: {
            key: "boolean",
            validate: lodash.isBoolean,
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
