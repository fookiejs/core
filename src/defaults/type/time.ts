import { Type } from "../../core/type";
import * as lodash from "lodash";

function isTime(value: unknown) {
    if (!lodash.isString(value)) return false;
    const timePatternFull = /^\d{2}:\d{2}:\d{2}$/; // Saat, dakika ve saniye
    const timePatternShort = /^\d{2}:\d{2}$/; // Sadece saat ve dakika
    return timePatternFull.test(value) || timePatternShort.test(value);
}

export const time = Type.new({
    key: "time",
    validate: isTime,
    example: "14:30",
    queryController: {
        equals: {
            key: "time",
            validate: isTime,
        },
        notEquals: {
            key: "time",
            validate: isTime,
        },
        in: {
            key: "time",
            validate: isTime,
            isArray: true,
        },
        notIn: {
            key: "time",
            validate: isTime,
            isArray: true,
        },
        lt: {
            key: "time",
            validate: isTime,
        },
        lte: {
            key: "time",
            validate: isTime,
        },
        gt: {
            key: "time",
            validate: isTime,
        },
        gte: {
            key: "time",
            validate: isTime,
        },
        isNull: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
    },
});
