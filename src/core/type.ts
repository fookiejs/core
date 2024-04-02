import { BaseClass } from "./base-class.ts";

export class Type extends BaseClass {
    key: string;
    nativeType: string;
    graphqlType: string;
    validate: (value: unknown) => boolean;
    transform: (value: unknown) => unknown;
    mock: unknown;
    QueryTypes: { [key: string]: Type };
    queryController: (val: unknown) => boolean;
}
