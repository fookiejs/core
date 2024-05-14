import { Type } from "../../core/type";
import * as lodash from "lodash";

export const timestamp = Type.new({
    key: "timestamp",
    validate: function (value: unknown) {
        if (!lodash.isString(value)) return false;
        const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
        return timestampPattern.test(value);
    },
    example: new Date().toISOString(),
    queryController: {
        equals: {
            key: "timestamp",
            validate: (value: unknown) => !isNaN(Date.parse(value as string)),
        },
        notEquals: {
            key: "timestamp",
            validate: (value: unknown) => !isNaN(Date.parse(value as string)),
        },
        in: {
            key: "timestamp",
            validate: (value: unknown) => !isNaN(Date.parse(value as string)),
            isArray: true,
        },
        notIn: {
            key: "timestamp",
            validate: (value: unknown) => !isNaN(Date.parse(value as string)),
            isArray: true,
        },
        before: {
            key: "timestamp",
            validate: (value: unknown) => !isNaN(Date.parse(value as string)),
        },
        after: {
            key: "timestamp",
            validate: (value: unknown) => !isNaN(Date.parse(value as string)),
        },
    },
});
