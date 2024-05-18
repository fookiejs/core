import { Type } from "../../core/type"
import * as lodash from "lodash"

function isTimestamp(value: unknown) {
    if (!lodash.isString(value)) return false
    const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
    return timestampPattern.test(value)
}

export const timestamp = Type.new({
    key: "timestamp",
    validate: isTimestamp,
    example: new Date().toISOString(),
    queryController: {
        equals: {
            key: "timestamp",
            validate: isTimestamp,
        },
        notEquals: {
            key: "timestamp",
            validate: isTimestamp,
        },
        in: {
            key: "timestamp",
            validate: isTimestamp,
            isArray: true,
        },
        notIn: {
            key: "timestamp",
            validate: isTimestamp,
            isArray: true,
        },
        lt: {
            key: "timestamp",
            validate: isTimestamp,
        },
        lte: {
            key: "timestamp",
            validate: isTimestamp,
        },
        gt: {
            key: "timestamp",
            validate: isTimestamp,
        },
        gte: {
            key: "timestamp",
            validate: isTimestamp,
        },
        isNull: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
    },
})
