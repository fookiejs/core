import { Type } from "../../core/type";
import * as lodash from "lodash";
import moment from "moment";

function isDate(value: unknown) {
    if (!lodash.isString(value)) return false;
    return moment(value, "YYYY-MM-DD", true).isValid();
}

export const date = Type.new({
    key: "date",
    validate: isDate,
    example: new Date("2023-01-01"),
    queryController: {
        equals: {
            key: "date",
            validate: isDate,
        },
        notEquals: {
            key: "date",
            validate: isDate,
        },
        in: {
            key: "date",
            validate: isDate,
            isArray: true,
        },
        notIn: {
            key: "date",
            validate: isDate,
            isArray: true,
        },
        before: {
            key: "date",
            validate: isDate,
        },
        after: {
            key: "date",
            validate: isDate,
        },
    },
});
