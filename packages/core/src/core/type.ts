import { BaseClass } from "./base-class.ts";

export class Type extends BaseClass {
  validate!: (value: unknown) => boolean;
  example!: unknown;
  queryController!: {
    [key: string]: _QueryValidator;
  };
  jsonType!: "string" | "number" | "boolean" | "object" | "array" | "date";
}

class _QueryValidator {
  key!: string;
  validate!: (value: unknown) => boolean;
  isArray?: boolean;
}
