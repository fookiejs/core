import { Type } from "../../core/type";

export const number = Type.new({
    key: "number",
    nativeType: "number",
    graphqlType: "Int",
    validate: function (value: unknown): boolean {
        return true;
    },
    transform: function (value: unknown): unknown {
        return value;
    },
    mock: 1,
    QueryTypes: {},
    queryController: function (val: unknown): boolean {
        return true;
    },
});
