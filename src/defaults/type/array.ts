import * as lodash from "lodash"
import { Type } from "../../core/type"

export const array = (innerType: Type) => {
    return Type.new({
        key: `${innerType.key}[]`,
        validate: (value) => lodash.isArray(value) && value.every(innerType.validate),
        example: [innerType.example],
        queryController: {},
    })
}
