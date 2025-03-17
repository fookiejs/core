import * as lodash from "https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js";
import { Type } from "../../core/type.ts";

export const array = (innerType: Type) => {
  return Type.create({
    key: `${innerType.key}[]`,

    validate: (value: any) =>
      lodash.isArray(value) && value.every(innerType.validate),
    example: [innerType.example],
    queryController: {},
    jsonType: "array",
  });
};
