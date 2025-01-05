import { BaseClass } from "./base-class"
import { Modify, Role } from "./lifecycle"

export class Exception extends BaseClass {
    lifecycle: Role
    func: Modify
}
