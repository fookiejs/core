import { BaseClass } from "./base-class.ts";

export class Type extends BaseClass {
    key: string;
    validate: (value: unknown) => boolean;
    example: unknown;
    queryController: any;
}
