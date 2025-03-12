import { BaseClass } from "../base-class"
import { BindsType } from "../model/model"
export * from "./binds/after"
export * from "./binds/before"
export * from "./binds/global"

export class Mixin extends BaseClass {
    binds: BindsType
}
