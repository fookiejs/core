import { Type } from "../../core/type.ts"
import * as lodash from "https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js"
export const boolean = Type.create({
  key: "boolean",
  validate: lodash.isBoolean,
  example: true,
  queryController: {
    equals: {
      key: "boolean",
      validate: lodash.isBoolean,
    },
    notEquals: {
      key: "boolean",
      validate: lodash.isBoolean,
    },
    isNull: {
      key: "boolean",
      validate: lodash.isBoolean,
    },
  },
  jsonType: "boolean",
})
