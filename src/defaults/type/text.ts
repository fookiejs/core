import { Type } from "../../core/type";

export const text = Type.new({
    key: "string",
    nativeType: "String",
    graphqlType: "String",
    validate: function (value: unknown): boolean {
        return true;
    },
    transform: function (value: unknown): unknown {
        return value;
    },
    mock: "hi",
    QueryTypes: {},
    queryController: function (val: unknown): boolean {
        return true;
    },
});
