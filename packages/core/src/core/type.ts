import { BaseClass } from "./base-class"

export class Type extends BaseClass {
    key: string
    validate: (value: unknown) => boolean
    example: unknown
    queryController: {
        [key: string]: QueryValidator
    }
}

class QueryValidator {
    key: string
    validate: (value: unknown) => boolean
    isArray?: boolean
}
