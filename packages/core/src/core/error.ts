import { BaseClass } from "./base-class"

export class FookieError extends BaseClass {
    description?: string
    validationErrors: {
        [key: string]: string[]
    }
}
